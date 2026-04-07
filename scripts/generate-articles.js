#!/usr/bin/env node
/**
 * Daily article generator for hvacsoftwarehub.com
 * Reads from article-queue.json, generates articles via Anthropic API,
 * writes .astro files, updates homepage, and commits.
 * 
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/generate-articles.js [count]
 * Default count: 3
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ARTICLES_PER_RUN = parseInt(process.argv[2] || '3', 10);
const API_KEY = process.env.ANTHROPIC_API_KEY;
const QUEUE_PATH = path.join(__dirname, 'article-queue.json');
const PAGES_DIR = path.join(__dirname, '..', 'src', 'pages', 'hvac');
const INDEX_PATH = path.join(__dirname, '..', 'src', 'pages', 'index.astro');

const AFFILIATE_LINKS = {
  jobber1: 'https://go.getjobber.com/bo42cjptz4m2',
  jobber2: 'https://go.getjobber.com/vcuhehgs796s',
  housecallpro: 'https://housecallpro.partnerlinks.io/auy5xcz257sw',
  toggl: 'https://get.toggl.com/f71dwhbrzvzz',
  apollo1: 'https://get.apollo.io/fxnpnadnv4lb',
  apollo2: 'https://get.apollo.io/007acgxiffe2',
};

const TODAY = new Date().toISOString().split('T')[0];

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable required');
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
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

function getSystemPrompt() {
  return `You are an expert HVAC industry content writer for hvacsoftwarehub.com, an independent review site for HVAC contractors.

RULES:
- Write factual, specific content with real pricing data and concrete comparisons
- No fluff, no filler, no generic advice. Every paragraph must contain actionable information.
- Include specific numbers: pricing, percentages, team sizes, ROI calculations
- Use a direct, authoritative tone. Write like someone who has talked to hundreds of HVAC contractors.
- Never use em dashes. Use commas, parentheses, or new sentences instead.
- All articles must reference these affiliate links where relevant (with rel="sponsored nofollow"):
  * Jobber: ${AFFILIATE_LINKS.jobber1} and ${AFFILIATE_LINKS.jobber2}
  * Housecall Pro: ${AFFILIATE_LINKS.housecallpro}
  * Toggl Track: ${AFFILIATE_LINKS.toggl}
  * Apollo.io: ${AFFILIATE_LINKS.apollo1} and ${AFFILIATE_LINKS.apollo2}
- Every article must end with a Meridian Gable CTA block (dark gradient background, white text) with:
  * Headline about Meridian Gable helping HVAC companies
  * Description mentioning AI voice agent, CRM setup, Carolina-based
  * Two buttons: "Book a Free 15-Min Audit" (https://calendly.com/meridiangable/free-hvac-audit) and "Call (800) 275-2868" (tel:+18002752868)
- Include internal links to existing articles where relevant:
  * /hvac/crm/best-crm-for-small-hvac-companies
  * /hvac/pricing/servicetitan-pricing
  * /hvac/pricing/housecall-pro-pricing
  * /hvac/pricing/jobber-pricing
  * /hvac/crm/jobber-vs-servicetitan
  * /hvac/crm/housecall-pro-vs-jobber
  * /hvac/crm/servicetitan-vs-housecall-pro
  * /hvac/crm/servicetitan-alternatives
  * /hvac/answering-service/best-hvac-answering-service
  * /hvac/dispatch/best-dispatch-software-for-hvac
  * /hvac/call-tracking/best-call-tracking-for-hvac
  * /hvac/guides/how-to-choose-hvac-software
  * /hvac/answering-service/ai-vs-traditional-answering-service
  * /hvac/answering-service/hvac-answering-service-cost
- Phone number for Meridian Gable is (800) 275-2868

OUTPUT FORMAT: Return ONLY the raw Astro component code. No markdown fences, no explanations. The output must start with --- and be a valid .astro file.`;
}

function getArticlePrompt(topic) {
  return `Write a complete Astro article page for hvacsoftwarehub.com.

TOPIC: ${topic.title}
DESCRIPTION: ${topic.description}
CATEGORY: ${topic.categoryLabel}
INTENT: ${topic.intent}
KEYWORDS: ${topic.keywords}
AFFILIATE CONTEXT: ${topic.affiliateContext}
PUBLISH DATE: ${TODAY}

Use this exact Astro template structure:

---
import ArticleLayout from '${topic.category === 'pricing' ? "'../../../layouts/ArticleLayout.astro'" : topic.category === 'crm' ? "'../../../layouts/ArticleLayout.astro'" : topic.category === 'dispatch' ? "'../../../layouts/ArticleLayout.astro'" : "'../../../layouts/ArticleLayout.astro'"};

const tocItems = [
  // 6-9 table of contents items with id and label
];
const faqItems = [
  // 5 FAQ items with q and a properties
];
---

<ArticleLayout
  title="${topic.title} — HVAC Software Hub"
  description="${topic.description}"
  canonicalPath="/hvac/${topic.category}/${topic.slug}"
  category="${topic.categoryLabel}"
  publishDate="${TODAY}"
  readTime="XX min read"
  intent="${topic.intent}"
  tocItems={tocItems}
  faqItems={faqItems}
>
<div class="container py-8">
  <div class="flex gap-12">
    <article class="flex-1 min-w-0 max-w-3xl">
      <!-- Article body with prose divs, tables, h2/h3 headings -->
      <!-- Include comparison tables with inline styles -->
      <!-- Include affiliate CTA buttons -->
      <!-- Include "Tools That Pair Well" section with Toggl and Apollo.io -->
    </article>
  </div>
</div>

<!-- Meridian Gable CTA banner (dark gradient) -->
<div style="background: linear-gradient(135deg, #0F2B46, #1B6B93); padding: 2rem; border-radius: 8px; margin-top: 2rem; color: white;">
  <!-- Headline, description, two CTA buttons -->
</div>

</ArticleLayout>

IMPORTANT:
- The import path for ArticleLayout must be correct relative to the file location: '../../../layouts/ArticleLayout.astro'
- Include real pricing data (research current numbers)
- Tables should use inline styles (background:#1B4F72 for headers, #f8f9fa for alt rows)
- Article should be 1,200-2,000 words
- Include at least one comparison table
- Include affiliate CTA buttons where natural
- End with the Meridian Gable gradient CTA block

Write the complete .astro file now.`;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function addToHomepage(topic) {
  let indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
  
  // Calculate read time estimate
  const readTime = topic.intent === 'BOFU' ? '12 min read' : '14 min read';
  
  // Build the new article entry
  const newEntry = `  { slug: "${topic.slug}", catSlug: "${topic.category}", title: "${topic.title}", desc: "${topic.description}", category: "${topic.categoryLabel}", intent: "${topic.intent}", readTime: "${readTime}", date: "${TODAY}" },`;
  
  // Insert after "const articles = ["
  indexContent = indexContent.replace(
    'const articles = [',
    `const articles = [\n${newEntry}`
  );
  
  fs.writeFileSync(INDEX_PATH, indexContent);
  console.log(`  Added to homepage: ${topic.title}`);
}

async function generateArticle(topic) {
  console.log(`\nGenerating: ${topic.title}`);
  
  const systemPrompt = getSystemPrompt();
  const articlePrompt = getArticlePrompt(topic);
  
  const astroContent = await callClaude(articlePrompt, systemPrompt);
  
  // Clean up any markdown fences if present
  let cleaned = astroContent.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }
  
  // Fix import path if needed
  cleaned = cleaned.replace(
    /import ArticleLayout from ['"].*?['"]/,
    "import ArticleLayout from '../../../layouts/ArticleLayout.astro'"
  );
  
  // Write the file
  const categoryDir = path.join(PAGES_DIR, topic.category);
  ensureDir(categoryDir);
  
  const filePath = path.join(categoryDir, `${topic.slug}.astro`);
  fs.writeFileSync(filePath, cleaned);
  console.log(`  Written: ${filePath}`);
  
  // Add to homepage
  addToHomepage(topic);
  
  return filePath;
}

async function main() {
  // Load queue
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  
  // Find existing articles to skip
  const existingFiles = [];
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.astro')) {
        existingFiles.push(item.replace('.astro', ''));
      }
    }
  }
  walkDir(PAGES_DIR);
  
  // Filter to unprocessed topics
  const pending = queue.filter(t => !existingFiles.includes(t.slug));
  
  if (pending.length === 0) {
    console.log('No pending articles in queue. Add more topics to scripts/article-queue.json');
    process.exit(0);
  }
  
  const batch = pending.slice(0, ARTICLES_PER_RUN);
  console.log(`Generating ${batch.length} articles (${pending.length} remaining in queue after this batch)`);
  
  const generated = [];
  for (const topic of batch) {
    try {
      const filePath = await generateArticle(topic);
      generated.push({ topic, filePath });
      // Small delay between API calls
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  FAILED: ${topic.title}: ${err.message}`);
    }
  }
  
  if (generated.length === 0) {
    console.log('No articles generated successfully.');
    process.exit(1);
  }
  
  console.log(`\n✓ Generated ${generated.length} articles`);
  generated.forEach(g => console.log(`  - ${g.topic.title}`));
  
  // Build to verify
  console.log('\nBuilding site...');
  try {
    execSync('npx astro build', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    console.log('✓ Build passed');
  } catch (err) {
    console.error('✗ Build FAILED. Reverting changes...');
    execSync('git checkout -- .', { cwd: path.join(__dirname, '..') });
    process.exit(1);
  }
  
  // Git commit
  console.log('\nCommitting...');
  const titles = generated.map(g => g.topic.slug).join(', ');
  execSync('git add -A', { cwd: path.join(__dirname, '..') });
  execSync(`git commit -m "Auto-generate articles: ${titles}"`, {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, GIT_AUTHOR_NAME: 'Article Bot', GIT_AUTHOR_EMAIL: 'bot@hvacsoftwarehub.com', GIT_COMMITTER_NAME: 'Article Bot', GIT_COMMITTER_EMAIL: 'bot@hvacsoftwarehub.com' },
  });
  console.log('✓ Committed');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
