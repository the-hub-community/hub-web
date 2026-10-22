/**
 * Updated Worker to handle multiple images
 */
const CONFIG = {
  DEFAULT_BRANCH: "feature/marketplace",
  GITHUB_REPO: "dekumar2-lab/lab-community",
  USER_AGENT: "Cloudflare-Worker-GitHub-Manager",
  CORS_HEADERS: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  },
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS")
      return new Response(null, { headers: CONFIG.CORS_HEADERS });

    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const type = formData.get("type");
        const images = formData.getAll("image"); // Fetch all files from the 'image' key

        if (!images.length)
          return new Response("No files provided", { status: 400 });

        const imageUrls = [];
        const timestamp = Date.now();

        // 1. Process and Upload all images to R2
        for (const [index, file] of images.entries()) {
          const fileName = `ads-${timestamp}-${index}-${file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()}`;
          await env.WIKI_BUCKET.put(fileName, file.stream(), {
            httpMetadata: { contentType: file.type },
          });
          imageUrls.push(
            `https://pub-9ea84fec129a441f863ae80a67787f61.r2.dev/${fileName}`,
          );
        }

        const publicUrlString = imageUrls.join(",");

        // 2. GitHub Logic
        if (type === "marketplace") {
          const title = formData.get("title");
          const slug = title
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
          const branchName = `ads/${slug}-${timestamp}`;
          const filePath = `_pros/${slug}.md`;

          // Get master SHA
          const masterRes = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/git/ref/heads/${CONFIG.DEFAULT_BRANCH}`,
            {
              headers: {
                Authorization: `token ${env.GH_TOKEN}`,
                "User-Agent": CONFIG.USER_AGENT,
              },
            },
          );
          const masterData = await masterRes.json();
          const masterSha = masterData.object.sha;

          // Create branch
          await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/git/refs`,
            {
              method: "POST",
              headers: {
                Authorization: `token ${env.GH_TOKEN}`,
                "User-Agent": CONFIG.USER_AGENT,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ref: `refs/heads/${branchName}`,
                sha: masterSha,
              }),
            },
          );

          // Commit Markdown with joined image URLs
          const markdown = `---
layout: marketplace-item
title: "${title}"
price: "${formData.get("price")}"
contact: "${formData.get("contact")}"
target_community: "${formData.get("condo")}"
category: "${formData.get("category")}"
image_url: "${publicUrlString}"
date: ${new Date().toISOString()}
---
${formData.get("content")}`;

          await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${filePath}`,
            {
              method: "PUT",
              headers: {
                Authorization: `token ${env.GH_TOKEN}`,
                "User-Agent": CONFIG.USER_AGENT,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: `Add Ad: ${title}`,
                content: btoa(unescape(encodeURIComponent(markdown))),
                branch: branchName,
              }),
            },
          );

          // Create PR
          const prRes = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/pulls`,
            {
              method: "POST",
              headers: {
                Authorization: `token ${env.GH_TOKEN}`,
                "User-Agent": CONFIG.USER_AGENT,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: `📢 New Ad: ${title}`,
                head: branchName,
                base: CONFIG.DEFAULT_BRANCH,
                body: `Automated ad submission with ${images.length} images.`,
              }),
            },
          );

          return new Response(JSON.stringify({ success: true }), {
            headers: CONFIG.CORS_HEADERS,
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: CONFIG.CORS_HEADERS,
        });
      }
    }
    return new Response("Not allowed", { status: 405 });
  },
};
