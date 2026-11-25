const fs = require("node:fs/promises");
const path = require("node:path");
const CleanCSS = require("clean-css");
const { minify: minifyHtml } = require("html-minifier-terser");
const { minify: minifyJavaScript } = require("terser");

const outputDirectory = path.resolve(process.argv[2] || "_site");
const htmlOptions = {
  collapseWhitespace: true,
  minifyCSS: true,
  minifyJS: (source) => minifyCode(source),
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
};

async function minifyHtmlDocument(source) {
  const rawMarkdownAttributes = [];
  const safeSource = source.replace(/\bdata-raw-md="([^"]*)"/gi, (attribute, value) => {
    const placeholder = `__HUB_RAW_MD_${rawMarkdownAttributes.length}__`;
    rawMarkdownAttributes.push({ placeholder, value });
    return `data-raw-md="${placeholder}"`;
  });
  let output = await minifyHtml(safeSource, htmlOptions);
  rawMarkdownAttributes.forEach(({ placeholder, value }) => {
    output = output.replace(
      `data-raw-md="${placeholder}"`,
      `data-raw-md="${value}"`,
    );
  });
  return output;
}

async function minifyCode(source) {
  const result = await minifyJavaScript(source, {
    compress: true,
    format: { comments: false },
    mangle: true,
  });
  if (typeof result.code !== "string") {
    throw new Error("JavaScript minifier returned no output.");
  }
  return result.code;
}

async function processFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const source = await fs.readFile(filePath, "utf8");
  let output;

  try {
    if (extension === ".html") {
      output = await minifyHtmlDocument(source);
    } else if (extension === ".js" && !filePath.endsWith(".min.js")) {
      output = await minifyCode(source);
    } else if (extension === ".css" && !filePath.endsWith(".min.css")) {
      const result = new CleanCSS({ level: 1 }).minify(source);
      if (result.errors.length) {
        throw new Error(result.errors.join("; "));
      }
      output = result.styles;
    } else if (extension === ".json" || extension === ".webmanifest") {
      output = JSON.stringify(JSON.parse(source));
    } else {
      return;
    }
  } catch (error) {
    throw new Error(`Minification failed for ${filePath}: ${error.message}`);
  }

  await fs.writeFile(filePath, output, "utf8");
}

async function processDirectory(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await processDirectory(entryPath);
    } else if (entry.isFile()) {
      await processFile(entryPath);
    }
  }
}

async function main() {
  const stats = await fs.stat(outputDirectory);
  if (!stats.isDirectory()) {
    throw new Error(`Build output is not a directory: ${outputDirectory}`);
  }
  await processDirectory(outputDirectory);
  console.log(`Minified production assets in ${outputDirectory}`);
}

main().catch((error) => {
  console.error("Production minification failed.", error);
  process.exitCode = 1;
});
