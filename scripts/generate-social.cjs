#!/usr/bin/env node
/**
 * Generates social media posts from recently published articles.
 * Reads articles from src/pages/hvac/, generates Facebook + LinkedIn posts via Anthropic API.
 * Outputs to scripts/social/posts-YYYY-MM-DD.md
 * 
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/generate-social.cjs [days_back]
 * Default: generates posts for articles published in the last 2 days
 */

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const DAYS_BACK = parseInt(process.argv[2] || '2', 10);
const PAGES_DIR = path.join(__dirname, '..', 'src', 'pages', 'hvac');
const OUTPUT_DIR = path.join(__dirname, 'social');
const TODAY = new Date().toISOString().split('T')[0];

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY required');
  process.exit(1);
}

async function callClaude(prompt, systemPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

function findRecentArticles() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_BACK);
  const articles = [];

  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.astro') && !item.startsWith('_')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const titleMatch = content.match(/title="([^"]+)"/);
        const descMatch = content.match(/description="([^"]+)"/);
        const dateMatch = content.match(/publishDate="(\d{4}-\d{2}-\d{2})"/);
        const pathMatch = content.match(/canonicalPath="([^"]+)"/);
        
        if (titleMatch && dateMatch && pathMatch) {
          const pubDate = new Date(dateMatch[1]);
          if (pubDate >= cutoff) {
            articles.push({
              title: titleMatch[1].replace(/ — HVAC Software Hub$/, ''),
              description: descMatch ? descMatch[1] : '',
              date: dateMatch[1],
              url: `https://hvacsoftwarehub.com${pathMatch[1]}`,
              slug: item.replace('.astro', ''),
            });
          }
        }
      }
    }
  }

  walkDir(PAGES_DIR);
  return articles;
}

async function generatePosts(articles) {
  const system = `You write social media posts for HVAC Software Hub, an independent review site for HVAC contractors.

RULES:
- Write like an HVAC business owner talking to peers, not like a marketer
- No emojis except sparingly (max 1 per post)
- No hashtags in Facebook posts (they reduce reach)
- LinkedIn posts can have 3-5 hashtags at the end
- Never use em dashes
- Include a specific data point or number in every post (pricing, percentages, stats)
- Posts should start conversations, not just promote
- Facebook posts: 50-150 words. Conversational, ask a question.
- LinkedIn posts: 100-200 words. Professional, insight-driven.
- For each article, create: 1 Facebook post (no link version), 1 Facebook post (with link), 1 LinkedIn post (with link)
- The link format: [ARTICLE_URL]
- Never mention Meridian Gable in social posts. Keep it educational/neutral.`;

  const prompt = `Generate social media posts for these recently published articles:

${articles.map((a, i) => `${i + 1}. "${a.title}" - ${a.description} - URL: ${a.url}`).join('\n')}

For EACH article, write:

## [Article Title]

### Facebook Post (No Link - Post First)
[conversational post that starts a discussion, no URL]

### Facebook Post (With Link - Post 24hrs Later)  
[value-add post with the article URL]

### LinkedIn Post
[professional post with the article URL and 3-5 hashtags]

---`;

  return await callClaude(prompt, system);
}

async function main() {
  const articles = findRecentArticles();
  
  if (articles.length === 0) {
    console.log(`No articles published in the last ${DAYS_BACK} days.`);
    process.exit(0);
  }

  console.log(`Found ${articles.length} recent articles:`);
  articles.forEach(a => console.log(`  - ${a.title} (${a.date})`));

  console.log('\nGenerating social posts...');
  const posts = await generatePosts(articles);

  const outputPath = path.join(OUTPUT_DIR, `posts-${TODAY}.md`);
  const header = `# Social Media Posts - ${TODAY}\n\nGenerated from ${articles.length} recent articles.\nPost the "No Link" Facebook version first, then the link version 24 hours later.\n\n---\n\n`;
  
  fs.writeFileSync(outputPath, header + posts);
  console.log(`\nSaved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
