/**
 * Scribd Document Downloader (Node / Puppeteer)
 *
 * Ports themrsami/scribd-downloader's headless Chrome + CDP print flow:
 * 1. Convert document URL → embed URL
 * 2. Open embed in Chromium
 * 3. Load pages via window.docManager in bounded batches
 * 4. Print each page with Page.printToPDF
 * 5. Merge disk-spooled pages with pdf-lib
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

const DEFAULT_CDP_TIMEOUT_SECONDS = intEnv('SCRIBD_CDP_TIMEOUT', 600);
const DEFAULT_PAGE_LOAD_TIMEOUT_SECONDS = Math.max(
  10,
  intEnv('SCRIBD_PAGE_LOAD_TIMEOUT', 120),
);
const DEFAULT_EXPORT_BATCH_SIZE = Math.max(
  1,
  intEnv('SCRIBD_EXPORT_BATCH_SIZE', 8),
);
const HEADLESS_ENABLED = !['0', 'false', 'no'].includes(
  String(process.env.SCRIBD_HEADLESS ?? '1')
    .trim()
    .toLowerCase(),
);

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize pasted/WhatsApp text and extract a Scribd document URL if present.
 * Accepts hash fragments (#google_vignette), query strings, optional www, http(s).
 * @param {string} input
 * @returns {{ id: string, url: string }|null}
 */
function extractScribdDocument(input) {
  const cleaned = String(input || '')
    // strip zero-width / bidi marks WhatsApp sometimes inserts around links
    .replace(/[\u200B-\u200D\uFEFF\u2060\u202A-\u202E]/g, '')
    .trim();

  const match = cleaned.match(
    /https?:\/\/(?:www\.)?scribd\.com\/(?:document|doc)\/(\d+)(?:\/[^\s]*)?/i,
  );
  if (!match) return null;

  const id = match[1];
  // Drop query/hash from the captured URL for a clean canonical form
  const pathPart = match[0].split(/[?#]/)[0].replace(/\/+$/, '');
  return {
    id,
    url: pathPart.startsWith('http')
      ? pathPart
      : `https://www.scribd.com/document/${id}`,
  };
}

/**
 * Convert a Scribd document URL (or pasted text containing one) to the embed URL.
 * @param {string} url
 * @returns {string|null}
 */
export function convertScribdLink(url) {
  const extracted = extractScribdDocument(url);
  if (!extracted) return null;
  return `https://www.scribd.com/embeds/${extracted.id}/content`;
}

/**
 * Build a default output filename from the last URL path segment.
 * @param {string} url
 * @returns {string}
 */
export function getFilenameFromUrl(url) {
  try {
    const extracted = extractScribdDocument(url);
    const raw = extracted?.url || String(url).split(/[?#]/)[0];
    const parsed = new URL(raw);
    const segments = parsed.pathname.replace(/\/+$/, '').split('/');
    const last = segments[segments.length - 1] || 'scribd_document';
    // Prefer slug over bare numeric id when both exist
    const slug =
      /^\d+$/.test(last) && segments.length >= 2
        ? segments[segments.length - 1]
        : last;
    return `${decodeURIComponent(slug)}.pdf`;
  } catch {
    return 'scribd_document.pdf';
  }
}

async function hideCookieDialogs(page) {
  await page.evaluate(() => {
    const closeButtonSelectors = [
      '[class*="cookie"] [class*="close"]',
      '[class*="cookie"] [class*="dismiss"]',
      '[class*="cookie"] button[aria-label*="close"]',
      '[class*="cookie"] button[aria-label*="Close"]',
      '[class*="consent"] [class*="close"]',
      '[class*="consent"] [class*="dismiss"]',
      '[class*="banner"] [class*="close"]',
      '[class*="banner"] [class*="dismiss"]',
      '[class*="notice"] [class*="close"]',
      '[class*="notice"] [class*="dismiss"]',
      'button[class*="close"]',
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      'button[aria-label="Dismiss"]',
      '[data-dismiss]',
      '[role="button"][class*="close"]',
    ];

    closeButtonSelectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((button) => button.click());
      } catch {
        /* ignore */
      }
    });

    const cookieSelectors = [
      '[class*="cookie"]',
      '[class*="Cookie"]',
      '[class*="consent"]',
      '[class*="Consent"]',
      '[class*="gdpr"]',
      '[class*="GDPR"]',
      '[id*="cookie"]',
      '[id*="Cookie"]',
      '[id*="consent"]',
      '[id*="gdpr"]',
      '[class*="privacy-notice"]',
      '[class*="Privacy"]',
      '[class*="cookie-banner"]',
      '[class*="cookie-notice"]',
      '[class*="cookie-popup"]',
      '[class*="cookie-modal"]',
      '[class*="CookieConsent"]',
      '[class*="notice-banner"]',
      '.cc-window',
      '.cc-banner',
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '.evidon-banner',
      '.truste_box_overlay',
      '[class*="osano-cm"]',
      '[id*="osano"]',
    ];

    cookieSelectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((element) => element.remove());
      } catch {
        /* ignore */
      }
    });

    document.querySelectorAll('*').forEach((element) => {
      try {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || '').toLowerCase();
        const fixedAtTop =
          (style.position === 'fixed' || style.position === 'sticky') &&
          rect.top < 100;

        if (
          fixedAtTop &&
          (text.includes('cookie') ||
            text.includes('privacy') ||
            text.includes('consent') ||
            text.includes('analytics') ||
            text.includes('advertising') ||
            text.includes('personalization'))
        ) {
          element.remove();
        }
      } catch {
        /* ignore */
      }
    });
  });
}

async function prepareDocumentForPrint(page) {
  const result = await page.evaluate(() => {
    const removed = { toolbarTop: false, toolbarBottom: false, containers: 0 };

    const toolbarTop = document.querySelector('.toolbar_top');
    if (toolbarTop) {
      toolbarTop.remove();
      removed.toolbarTop = true;
    }

    const toolbarBottom = document.querySelector('.toolbar_bottom');
    if (toolbarBottom) {
      toolbarBottom.remove();
      removed.toolbarBottom = true;
    }

    document.querySelectorAll('.document_scroller').forEach((element) => {
      element.setAttribute('data-scribd-print-root', 'true');
      element.style.position = 'static';
      element.style.top = 'auto';
      element.style.bottom = 'auto';
      element.style.left = 'auto';
      element.style.right = 'auto';
      element.style.overflow = 'visible';
      element.style.maxHeight = 'none';
      element.style.height = 'auto';
      element.style.margin = '0';
      element.style.padding = '0';
      removed.containers += 1;
    });

    return removed;
  });

  if (result.toolbarTop) console.log('Top toolbar removed.');
  if (result.toolbarBottom) console.log('Bottom toolbar removed.');
  console.log(`Adjusted ${result.containers} scroll containers for print.`);
}

async function injectPrintStyles(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('scribd-print-styles');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'scribd-print-styles';
    style.textContent = `
      [class*="cookie"],
      [class*="Cookie"],
      [class*="consent"],
      [class*="Consent"],
      [class*="gdpr"],
      [class*="privacy-notice"],
      [class*="notice-banner"],
      [id*="cookie"],
      [id*="consent"],
      [class*="osano-cm"],
      [id*="osano"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }

      [data-scribd-print-root="true"],
      .document_scroller {
        position: static !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      @media print {
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .toolbar_top,
        .toolbar_bottom {
          display: none !important;
        }

        [data-scribd-print-root="true"],
        .document_scroller {
          position: static !important;
          top: auto !important;
          right: auto !important;
          bottom: auto !important;
          left: auto !important;
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        mjx-container,
        .MathJax,
        .katex,
        math,
        svg {
          visibility: visible !important;
          overflow: visible !important;
        }
      }
    `;
    document.head.appendChild(style);
  });
  console.log('Print CSS injected.');
}

async function loadPageBatch(page, pageNumbers) {
  const timeoutMs = DEFAULT_PAGE_LOAD_TIMEOUT_SECONDS * 1000;

  const result = await Promise.race([
    page.evaluate(
      (nums, budgetMs) =>
        new Promise((done) => {
          const manager = window.docManager;
          if (!manager || !manager.pages) {
            done({ supported: false });
            return;
          }

          const states = nums.map((pageNum) => ({
            pageNum,
            page: manager.pages[pageNum],
            error: null,
          }));
          const startedAt = Date.now();

          for (const state of states) {
            if (!state.page) {
              state.error = 'page object missing';
              continue;
            }
            try {
              if (!state.page.innerPageElem && !state.page.loadHasStarted) {
                state.page.load();
              }
            } catch (error) {
              state.error = String(error);
            }
          }

          const timer = setInterval(() => {
            let ready = 0;

            for (const state of states) {
              if (state.error) {
                ready += 1;
                continue;
              }

              const p = state.page;
              if (!p.innerPageElem) continue;

              try {
                p.display();
                if (!p._imagesTurnedOn) {
                  p.turnOnImages();
                }
              } catch (error) {
                state.error = String(error);
                ready += 1;
                continue;
              }

              const images = Array.from(
                p.innerPageElem.querySelectorAll('img'),
              );
              const pending = images.filter((image) => !image.complete);
              if (pending.length === 0) ready += 1;
            }

            if (ready === states.length) {
              clearInterval(timer);
              done({
                supported: true,
                failed: states
                  .filter((state) => state.error)
                  .map((state) => ({
                    pageNum: state.pageNum,
                    reason: state.error,
                  })),
              });
              return;
            }

            if (Date.now() - startedAt >= budgetMs) {
              clearInterval(timer);
              done({
                supported: true,
                failed: states
                  .filter(
                    (state) =>
                      state.error ||
                      !state.page ||
                      !state.page.innerPageElem ||
                      Array.from(
                        state.page.innerPageElem.querySelectorAll('img'),
                      ).some((image) => !image.complete),
                  )
                  .map((state) => ({
                    pageNum: state.pageNum,
                    reason: state.error || 'page or image load timed out',
                  })),
              });
            }
          }, 50);
        }),
      pageNumbers,
      timeoutMs,
    ),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Page batch load timed out')),
        timeoutMs + 15_000,
      ),
    ),
  ]);

  if (!result?.supported) {
    throw new Error('Scribd direct page loader is unavailable.');
  }

  if (result.failed?.length) {
    const details = result.failed
      .map((item) => `${item.pageNum} (${item.reason})`)
      .join(', ');
    throw new Error(`Failed to load Scribd page(s): ${details}`);
  }
}

async function releasePageBatch(page, cdp, pageNumbers) {
  await page.evaluate((nums) => {
    const manager = window.docManager;
    if (!manager || !manager.pages) return;

    for (const pageNum of nums) {
      const p = manager.pages[pageNum];
      if (!p) continue;

      try {
        p.remove();
      } catch {
        const container = document.getElementById(`outer_page_${pageNum}`);
        if (container) {
          const inner = container.querySelector('.newpage');
          if (inner) inner.remove();
        }
      }
    }
  }, pageNumbers);

  try {
    await cdp.send('HeapProfiler.collectGarbage');
  } catch {
    /* best effort */
  }
}

async function isolateAndMeasurePage(page, targetIndex) {
  return page.evaluate((index) => {
    const pages = Array.from(document.querySelectorAll('.outer_page'));
    const target = pages[index];
    if (!target) return null;

    const oldStyle = document.getElementById('isolated-page-print-style');
    if (oldStyle) oldStyle.remove();

    pages.forEach((p) => {
      p.style.removeProperty('display');
      p.style.removeProperty('visibility');
      p.style.removeProperty('position');
      p.style.removeProperty('top');
      p.style.removeProperty('left');
      p.style.removeProperty('right');
      p.style.removeProperty('bottom');
      p.style.removeProperty('margin');
      p.style.removeProperty('break-after');
      p.style.removeProperty('page-break-after');
      p.style.removeProperty('break-before');
      p.style.removeProperty('page-break-before');
    });

    const rect = target.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    pages.forEach((p) => p.removeAttribute('data-export-target'));
    target.setAttribute('data-export-target', 'true');

    const style = document.createElement('style');
    style.id = 'isolated-page-print-style';
    style.textContent = `
      @page {
        size: ${width}px ${height}px;
        margin: 0;
      }

      @media print {
        html,
        body {
          width: ${width}px !important;
          height: ${height}px !important;
          min-width: ${width}px !important;
          min-height: ${height}px !important;
          max-width: ${width}px !important;
          max-height: ${height}px !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .outer_page {
          display: none !important;
        }

        .outer_page[data-export-target="true"] {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: auto !important;
          bottom: auto !important;
          width: ${width}px !important;
          height: ${height}px !important;
          min-width: 0 !important;
          min-height: 0 !important;
          max-width: none !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          transform: none !important;
          break-before: auto !important;
          break-after: auto !important;
          break-inside: auto !important;
          page-break-before: auto !important;
          page-break-after: auto !important;
          page-break-inside: auto !important;
          overflow: hidden !important;
        }
      }
    `;
    document.head.appendChild(style);

    return { width, height };
  }, targetIndex);
}

async function mergePdfFiles(pageFiles, outputPath) {
  const merged = await PDFDocument.create();

  for (const pagePath of pageFiles) {
    const bytes = await fs.readFile(pagePath);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }

  const outBytes = await merged.save();
  await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  await fs.writeFile(outputPath, outBytes);
}

async function savePdfPagesIndividually(page, cdp, outputPath) {
  const pageCount = await page.evaluate(
    () => document.querySelectorAll('.outer_page').length,
  );

  if (pageCount <= 0) {
    throw new Error('No .outer_page elements found.');
  }

  console.log(
    `Exporting ${pageCount} document pages in bounded batches of ${DEFAULT_EXPORT_BATCH_SIZE}...`,
  );

  const spoolDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribd-pdf-pages-'));
  const pageFiles = [];
  let batchPageNumbers = [];

  try {
    for (let index = 0; index < pageCount; index += 1) {
      if (index % DEFAULT_EXPORT_BATCH_SIZE === 0) {
        const batchEnd = Math.min(pageCount, index + DEFAULT_EXPORT_BATCH_SIZE);
        batchPageNumbers = [];
        for (let n = index + 1; n <= batchEnd; n += 1) batchPageNumbers.push(n);
        console.log(
          `  Loading page batch ${index + 1}-${batchEnd}/${pageCount}...`,
        );
        await loadPageBatch(page, batchPageNumbers);
      }

      const pageInfo = await isolateAndMeasurePage(page, index);
      if (!pageInfo) {
        console.log(`  Skipping page ${index + 1}: element missing`);
        continue;
      }

      const { width: widthPx, height: heightPx } = pageInfo;
      if (widthPx <= 0 || heightPx <= 0) {
        console.log(
          `  Skipping page ${index + 1}: invalid geometry ${widthPx}x${heightPx}`,
        );
        continue;
      }

      const widthInches = widthPx / 96;
      const heightInches = heightPx / 96;
      console.log(
        `  Page ${index + 1}/${pageCount} ${widthPx}x${heightPx}px -> ${widthInches.toFixed(3)}"x${heightInches.toFixed(3)}"`,
      );

      await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });

      const result = await cdp.send('Page.printToPDF', {
        landscape: false,
        displayHeaderFooter: false,
        printBackground: true,
        scale: 1,
        paperWidth: widthInches,
        paperHeight: heightInches,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        preferCSSPageSize: true,
        pageRanges: '1',
        transferMode: 'ReturnAsBase64',
      });

      const pdfBytes = Buffer.from(result.data, 'base64');
      const single = await PDFDocument.load(pdfBytes);
      if (single.getPageCount() !== 1) {
        throw new Error(
          `Document page ${index + 1} produced ${single.getPageCount()} PDF sheets; expected exactly 1.`,
        );
      }

      const pagePath = path.join(
        spoolDir,
        `page-${String(index + 1).padStart(8, '0')}.pdf`,
      );
      await fs.writeFile(pagePath, pdfBytes);
      pageFiles.push(pagePath);
      console.log('    OK: exactly 1 PDF sheet');

      const isBatchEnd =
        (index + 1) % DEFAULT_EXPORT_BATCH_SIZE === 0 ||
        index + 1 === pageCount;
      if (isBatchEnd) {
        await releasePageBatch(page, cdp, batchPageNumbers);
      }
    }

    if (!pageFiles.length) {
      throw new Error('No valid document pages were exported.');
    }

    console.log(`Merging ${pageFiles.length} disk-spooled PDF pages...`);
    await mergePdfFiles(pageFiles, outputPath);
    return path.resolve(outputPath);
  } finally {
    await fs.rm(spoolDir, { recursive: true, force: true });
  }
}

/**
 * Download a Scribd document URL as a local PDF via headless Chrome.
 *
 * @param {string} url - Scribd /document/ or /doc/ URL
 * @param {string} [outputPath] - Destination PDF path (default from URL slug)
 * @returns {Promise<string>} Absolute path to the saved PDF
 */
export async function downloadScribd(url, outputPath) {
  const embedUrl = convertScribdLink(url);
  if (!embedUrl) {
    throw new Error(
      'Invalid Scribd URL. Expected https://www.scribd.com/document/<id>/... or /doc/<id>/...',
    );
  }

  const resolvedOutput = path.resolve(outputPath || getFilenameFromUrl(url));
  const profileDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scribd-chrome-profile-'),
  );

  let browser;
  try {
    console.log('Starting Chrome browser...');
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: HEADLESS_ENABLED ? 'new' : false,
      userDataDir: profileDir,
      protocolTimeout: DEFAULT_CDP_TIMEOUT_SECONDS * 1000,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1600,2200',
        '--disable-blink-features=AutomationControlled',
        '--force-color-profile=srgb',
        '--hide-scrollbars',
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(DEFAULT_CDP_TIMEOUT_SECONDS * 1000);
    page.setDefaultNavigationTimeout(DEFAULT_CDP_TIMEOUT_SECONDS * 1000);

    await page.goto(embedUrl, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1000));

    await hideCookieDialogs(page);
    console.log('Cookie dialogs hidden.');

    const totalPages = await page.evaluate(
      () => document.querySelectorAll('.outer_page').length,
    );
    if (totalPages === 0) {
      throw new Error('No printable document pages were detected.');
    }

    await prepareDocumentForPrint(page);
    await injectPrintStyles(page);

    console.log(`\nSaving PDF as: ${resolvedOutput}`);
    console.log('  Export mode: Individual document pages');
    console.log('  Margins: None');
    console.log('  Headers/Footers: Disabled');
    console.log(`  CDP timeout: ${DEFAULT_CDP_TIMEOUT_SECONDS}s`);

    await page.evaluate(() => window.scrollTo(0, 0));

    const cdp = await page.createCDPSession();
    const savedPath = await savePdfPagesIndividually(page, cdp, resolvedOutput);

    console.log(`PDF saved successfully to: ${savedPath}`);
    return savedPath;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
    await fs.rm(profileDir, { recursive: true, force: true });
  }
}

async function main() {
  const inputUrl = process.argv[2];
  const outputArg = process.argv[3];

  if (!inputUrl) {
    console.error('Usage: node download.js "<scribd-url>" [outputPath]');
    console.error(
      'Example: node download.js "https://www.scribd.com/document/123456789/Document-Title"',
    );
    process.exit(1);
  }

  const embedUrl = convertScribdLink(inputUrl);
  const pdfFilename = outputArg || getFilenameFromUrl(inputUrl);

  console.log(`Link embed: ${embedUrl ?? 'Invalid Scribd URL'}`);
  console.log(`Output filename: ${pdfFilename}`);

  if (!embedUrl) {
    console.error('Error: Please provide a valid Scribd document URL');
    console.error(
      'Example: https://www.scribd.com/document/123456789/Document-Title',
    );
    console.error(
      'Example: https://www.scribd.com/doc/123456789/Document-Title',
    );
    process.exit(1);
  }

  try {
    await downloadScribd(inputUrl, pdfFilename);
  } catch (error) {
    console.error(`Export failed: ${error.message || error}`);
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;

if (isDirectRun) {
  main();
}
