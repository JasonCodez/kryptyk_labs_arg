'use client';

import React, { JSX, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createDefaultGridlockFileData, getGridlockFileData } from '@/lib/gridlockFile';
import { createDefaultVaultData, getVaultDerivedLetters, getVaultPuzzleData } from '@/lib/vault';
import { generateWordSearchGrid, normalizeWordList, type WordSearchGenerationDifficulty } from '@/lib/wordSearchCore';
import {
  generateCrosswordFromSeedEntries,
  type CrosswordGeneratorSeedEntry,
} from '@/lib/crosswordGenerator';
// Dynamically import the advanced Escape Room Designer (client-side only)
const EscapeRoomDesigner = dynamic(() => import("@/app/escape-rooms/Designer"), { ssr: false });

// ── Code Master puzzle starter templates ────────────────────────────────────
const CODE_MASTER_TEMPLATES: {
  id: string;
  name: string;
  track: string;
  trackIcon: string;
  description: string;
  data: Record<string, unknown>;
}[] = [
  // ── HTML 0: Your First HTML Page ──────────────────────────────────────────
  {
    id: 'html-structure',
    name: 'Your First HTML Page',
    track: 'HTML Basics',
    trackIcon: '🌐',
    description: 'Fix a broken HTML document — learn the essential skeleton every webpage needs.',
    data: {
      language: 'html',
      track: 'HTML Basics',
      trackOrder: 1,
      concepts: ['HTML', 'document structure', 'tags', 'head', 'body', 'doctype'],
      scenario: 'Someone handed you a webpage but it\'s broken — the head section isn\'t closed properly and the body is left hanging open. The browser is guessing wildly at your structure. Fix the skeleton so it becomes a valid HTML5 document.',
      theory: `── What is HTML? ────────────────────────────────────────────
HTML stands for HyperText Markup Language. It is the language of the web.

Every single webpage you have ever visited — Google, YouTube, Instagram — is built on HTML. Your browser reads HTML and turns it into the visual page you see.

── What is a "tag"? ─────────────────────────────────────────
HTML is written with TAGS. A tag is a keyword wrapped in angle brackets < >

  Opening tag:  <p>
  Closing tag:  </p>   ← note the forward slash — it closes the element
  Content:      <p>This is a paragraph of text.</p>

Tags come in pairs. Everything between them is the content:
  <h1>Big Heading</h1>
  <p>A paragraph.</p>
  <strong>Bold text</strong>

Some tags are self-closing (no content, no separate closing tag):
  <img src="photo.jpg" alt="A dog" />
  <br />    ← line break
  <hr />    ← horizontal line

── The essential HTML skeleton ──────────────────────────────
Every valid HTML page MUST have this exact structure:

  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Page Title</title>
    </head>
    <body>
      ... everything visible goes here ...
    </body>
  </html>

Here is what each part means:
  <!doctype html>        — Tells the browser: "This is an HTML5 page." Must be the very first line.
  <html lang="en">       — The root element that wraps everything. lang="en" tells screen readers the language.
  <head> ... </head>     — INVISIBLE metadata. The browser reads this but the user never sees it directly.
  <meta charset="utf-8"> — Ensures the page can display accented letters, emojis, and every language.
  <title>...</title>     — Shown in the browser tab and in Google search results.
  <body> ... </body>     — EVERYTHING THE USER SEES goes in here: text, images, buttons, forms.

── What is nesting? ─────────────────────────────────────────
Elements that live inside other elements are called NESTED.
The most important rule: always close the inner element before the outer one.

  ✅ Correct:
  <body>
    <h1>Welcome</h1>
    <p>Some text.</p>
  </body>

  ❌ Wrong (never do this):
  <body>
    <h1>Welcome</body>
  </h1>

── The bug in this puzzle ───────────────────────────────────
1. <head> was used as a closing tag instead of </head>
2. The </body> and </html> closing tags are missing entirely

Fix: change <head> to </head> and add </body></html> at the end.`,
      lessonSummary: `You fixed the broken HTML structure — the page is now valid HTML5. 🎉

What you repaired:
  1. <head> → </head>    A closing tag must have a forward slash. Without it, the browser
                         had no idea where the head section ended.
  2. Added </body>        Every opened tag must be properly closed.
  3. Added </html>        The root element needs to be closed too.

The skeleton you now know by heart:
  <!doctype html>
  <html lang="en">
    <head> ... metadata ... </head>
    <body> ... visible content ... </body>
  </html>

Browsers actually try to "repair" broken HTML on the fly — but they don't always guess right, which leads to weird visual glitches on real sites.

This structure is the foundation of every webpage on the internet. From a student portfolio to a Fortune 500 company website — they all start with these exact same lines.

You've learned:
  ✓ What HTML is and what it is for
  ✓ What tags are and how opening/closing pairs work
  ✓ The required skeleton that every HTML document needs
  ✓ The difference between <head> (invisible) and <body> (visible)

Day 1, Lesson 1. You've got it. 💪`,
      brokenCode: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My First Page</title>
  <head>
  <body>
    <h1>Hello, World!</h1>
    <p>My very first webpage. The structure is broken — fix it!</p>`,
      validationMode: 'contains',
      validationRules: {
        mustContain: ['</head>', '</body>', '</html>'],
        mustNotContain: ['  <head>\n  <body>'],
        ignoreCase: true,
        ignoreWhitespace: false,
      },
    },
  },
  // ── HTML 1: Fix the Navigation ────────────────────────────────────────────
  {
    id: 'html-nav',
    name: 'Fix the Navigation',
    track: 'HTML Basics',
    trackIcon: '🌐',
    description: 'Replace a <div> with the correct semantic <nav> element.',
    data: {
      language: 'html',
      track: 'HTML Basics',
      trackOrder: 2,
      concepts: ['HTML', 'semantic elements', 'nav', 'accessibility', 'SEO'],
      scenario: 'The site navigation is wrapped in a generic <div> — but HTML has a dedicated element for navigation. Screen readers can\'t recognise the nav landmark and keep users in the dark. Your mission: replace the <div class="nav"> with the correct semantic element.',
      theory: `── Quick recap: what is HTML doing? ─────────────────────────
HTML describes the STRUCTURE and MEANING of content. Not the look (that is CSS) — the meaning.

When you write <h1>Welcome</h1>, you are not just making text big. You are saying: "this is the most important heading on the page."

That distinction — communicating meaning — is what this puzzle is about.

── The problem with <div> ───────────────────────────────────
A <div> is a generic container. It means absolutely nothing on its own.

  <div class="nav">           ← just a box. Could be anything.
    <a href="/">Home</a>
  </div>

The class="nav" gives it a visual name, but it is just a label for your CSS — it communicates nothing to the browser, screen reader, or search engine.

── Semantic HTML ────────────────────────────────────────────
HTML5 (2014) introduced SEMANTIC elements — tags that describe WHAT the content is, not just how to group it.

Here are the most important ones you will use on every project:

  <header>     — the top section of a page or article (logo, nav, hero)
  <nav>        — a group of navigation links
  <main>       — the primary content area of the page (only ONE per page)
  <section>    — a themed grouping of related content with a heading
  <article>    — a self-contained, independently distributable piece (blog post, news item)
  <aside>      — secondary content, sidebars, callouts, related links
  <footer>     — the bottom section of a page or article

── Why does this matter? ────────────────────────────────────
There are three groups who benefit from semantic HTML:

1. SCREEN READER USERS
   Blind and low-vision users navigate with a screen reader. These tools
   understand semantic landmarks. When they encounter <nav>, they announce:
   "Navigation landmark" — and the user can jump straight to it with a single keystroke.
   With a <div>, there is no landmark. The user must listen to the entire page from the top.
   Over 1 billion people live with a disability. Semantic HTML costs you nothing and helps them enormously.

2. SEARCH ENGINES
   Google, Bing, and other search engines read HTML to understand your page.
   They know that links inside <nav> are navigation — and weight them differently
   to links inside <article> body text. Semantic HTML directly improves SEO.

3. DEVELOPERS
   When another developer (or future-you) reads the HTML, semantic elements are
   self-documenting. <nav> needs no explanation. <div class="nav"> requires context.

── The fix ──────────────────────────────────────────────────
Replace <div class="nav"> with <nav>
Replace the closing </div> with </nav>
The class="nav" attribute can be removed — <nav> already communicates the role.`,
      lessonSummary: `You replaced <div class="nav"> with <nav>. One element name changed — and the entire meaning of that block transformed. 🎉

What just happened:
  Before: a generic box with a CSS class label
  After:  a proper HTML landmark that browsers, screen readers, and search engines all understand

The real-world impact of your one-line fix:
  • Accessibility: a blind user can now press a keyboard shortcut to jump straight
    to the navigation landmark — instead of having to listen to the entire page from top.
  • SEO: Google now knows these are navigation links, not body content.
  • Developer experience: every person who reads this HTML instantly understands the purpose.

This is called "accessible by default" — making the right choice costs you nothing extra,
but it makes your site usable by millions more people.

Semantic elements to use from now on (instead of plain <div>):
  Site header?       → <header>
  Navigation links?  → <nav>
  Main content?      → <main>
  Related grouping?  → <section>
  Blog post / card?  → <article>
  Sidebar?           → <aside>
  Site footer?       → <footer>

You are already thinking like a professional front-end developer. 🚀`,
      brokenCode: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mission: NavFix</title>
  </head>
  <body>
    <div class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </div>
    <main>
      <h1>Welcome to the site!</h1>
      <p>The navigation above uses a plain div. Replace it with the correct semantic element.</p>
    </main>
  </body>
</html>`,
      validationMode: 'contains',
      validationRules: {
        mustContain: ['<nav>', '</nav>'],
        mustNotContain: ['<div class="nav">'],
        ignoreCase: true,
        ignoreWhitespace: false,
      },
    },
  },
  // ── HTML 2: Missing Alt Text ───────────────────────────────────────────────
  {
    id: 'html-alt',
    name: 'Missing Alt Text',
    track: 'HTML Basics',
    trackIcon: '🌐',
    description: 'Add a meaningful alt attribute to an img element.',
    data: {
      language: 'html',
      track: 'HTML Basics',
      trackOrder: 3,
      concepts: ['HTML', 'accessibility', 'alt text', 'img', 'WCAG'],
      scenario: 'A team photo is on the page with no alt attribute. When a screen reader hits it, the user hears nothing — or worse, the raw filename. Add a meaningful alt description so everyone gets the same information.',
      theory: `── The <img> element ────────────────────────────────────────
The <img> element displays an image. It has two essential attributes:

  <img src="team-photo.jpg" alt="Five engineers gathered around a whiteboard" />
       ↑                         ↑
       src = the image file      alt = a text description

  src (source)  — the path or URL to the image file. Required.
  alt (alternate text) — a text replacement for the image. Required for accessibility.

── What does alt actually do? ───────────────────────────────
alt serves THREE critical purposes:

  1. SCREEN READERS
     When a person who is blind browses your page with a screen reader,
     the software reads alt text aloud instead of showing the image.
     Without alt: the reader might say nothing, or read "team-photo-v3-final-FINAL.jpg"
     With alt:    the reader says "Five engineers gathered around a whiteboard"
     Which one gives the user the same information a sighted person gets?

  2. BROKEN IMAGES
     If the image file is missing, moved, or the network is slow,
     the alt text is displayed in the image's place.
     Without alt: the user sees a broken image icon and has no idea what was there.
     With alt:    the user reads the description and understands the context.

  3. SEARCH ENGINES
     Google Image Search relies on alt text to understand what images show.
     Images with good alt text appear in image search results.
     Images without it are essentially invisible to Google Images.

── How to write good alt text ───────────────────────────────

✅ Describe what is VISIBLE in the image:
  alt="A golden retriever playing fetch on a sunny beach"
  alt="Bar chart showing monthly sales rising 40% in Q3"
  alt="Five engineers gathered around a whiteboard with diagrams"

✅ For FUNCTIONAL images (icons used as buttons), describe the action:
  alt="Search"            ← for a magnifying glass icon on a search button
  alt="Close dialog"      ← for an × button
  alt="Share on Twitter"  ← for a Twitter icon button

✅ For DECORATIVE images (visual only, no meaning), use empty alt:
  alt=""     ← explicitly tells screen readers "skip this — it adds no information"
  Note: alt="" (empty string) is very different from omitting alt entirely.
  Missing alt = bad. Empty alt="" = intentional and correct for decorative images.

❌ Never do any of these:
  alt="image"                   — meaningless
  alt="photo.jpg"               — just repeating the filename
  alt="picture of a man"        — too vague; describe what matters
  (no alt attribute at all)     — screen readers will guess, often badly

── The accessibility standard ───────────────────────────────
The Web Content Accessibility Guidelines (WCAG) require descriptive alt text on all
meaningful images. This is a Level A requirement — the most basic accessibility standard.
Companies including Target, Domino's, and Netflix have faced lawsuits over missing alt text.

Writing alt text takes 5 extra seconds. It makes your site usable by everyone.`,
      lessonSummary: `You added a meaningful alt attribute to the image. That one attribute just opened this page up to blind and low-vision users. 🎉

Put yourself in their position:
Imagine browsing the web with your eyes closed, listening to a screen reader.
Every image without alt text is a complete mystery. The reader might say "image" or read a gobbledygook filename. With your alt text, the user hears exactly what you intended them to know.

The rule is simple — use it every single time you write an <img>:
  Does the image add meaning to the page?
    → Write a genuine description of what it shows.
  Is it purely decorative? (a divider line, a background texture)
    → Use alt="" (empty string) to tell screen readers to skip it.

This habit applies to everything you will ever build:
  Blog post?        → describe every photo
  Product page?     → describe every product image in detail
  Team page?        → introduce every person in the photo
  Icon buttons?     → describe what the icon does
  Charts/graphs?    → describe the data the chart shows

One attribute. Five seconds to write. Accessible to millions.
That mindset — building for everyone by default — is what defines great developers. 🌍`,
      brokenCode: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Our Team</title>
  </head>
  <body>
    <main>
      <h1>Our Team</h1>
      <img src="/images/team-photo.jpg" />
      <p>The best team around. Add an alt attribute to the image above!</p>
    </main>
  </body>
</html>`,
      validationMode: 'contains',
      validationRules: {
        mustContain: ['alt="'],
        mustNotContain: ['<img src="/images/team-photo.jpg" />'],
        ignoreCase: true,
        ignoreWhitespace: false,
      },
    },
  },
  // ── CSS 1: Fix Broken Flexbox ─────────────────────────────────────────────
  {
    id: 'css-flexbox',
    name: 'Fix Broken Flexbox',
    track: 'CSS Fundamentals',
    trackIcon: '🎨',
    description: 'Change display: block to display: flex to fix a stacking nav bar.',
    data: {
      language: 'css',
      track: 'CSS Fundamentals',
      trackOrder: 1,
      concepts: ['CSS', 'flexbox', 'display', 'layout', 'block vs flex'],
      scenario: 'The nav bar links should sit side by side in a row — but they\'re all stacking vertically. The developer left display set to the wrong value. One word is all that stands between a broken stack and a proper nav bar. Find it.',
      theory: `── What is CSS? ─────────────────────────────────────────────
If HTML is the skeleton of a webpage, CSS (Cascading Style Sheets) is everything you see — colours, fonts, spacing, and most importantly, LAYOUT.

CSS works through RULES. Each rule has three parts:

  selector {          ← WHICH element(s) to style
    property: value;  ← WHAT to change and HOW
  }

Example:
  nav {
    background: #1a1a2e;  ← property: background | value: #1a1a2e (a dark blue)
    padding: 16px;        ← property: padding     | value: 16px (space inside)
  }

── What is the "display" property? ─────────────────────────
Every HTML element has a default display type. The two most common defaults are:

  display: block

    The element takes up the FULL WIDTH of its container.
    Each block element starts on a NEW LINE below the previous one.
    Think of it like stacking bricks — one on top of the other.
    Examples: <p>, <div>, <h1>, <section>

  display: inline

    The element only takes up as much width as its content.
    Inline elements sit SIDE BY SIDE in a line of text.
    They cannot have a width or height set.
    Examples: <span>, <a>, <strong>, <em>

The problem: display: block stacks elements vertically.
For a navigation bar, we want items sitting horizontally side by side.
This is what Flexbox solves.

── What is Flexbox? ─────────────────────────────────────────
Flexbox (Flexible Box Layout) is a CSS layout model that makes arranging items in rows or columns simple and predictable.

You add display: flex to a CONTAINER. All direct children of that container
automatically become "flex items" and line up side by side.

  Before display: flex      After display: flex
  ┌────────┐                ┌──────┬──────┬──────┐
  │ Home   │                │ Home │About │ Blog │
  ├────────┤                └──────┴──────┴──────┘
  │ About  │
  ├────────┤
  │ Blog   │
  └────────┘

── Key Flexbox properties on the container ─────────────────
  display: flex                — activates Flexbox (all children line up in a row)
  flex-direction: row          — left to right (this is the DEFAULT)
  flex-direction: column       — top to bottom
  gap: 16px                    — space between each child element
  align-items: center          — vertically centres all children
  align-items: flex-start      — aligns children to the top
  justify-content: center      — horizontally centres all children
  justify-content: space-between — pushes children to opposite ends
  justify-content: flex-end    — pushes children to the right

── On flex children (individual items) ─────────────────────
  flex: 1    — this child grows to fill all available space
  flex: 0    — this child stays exactly its content size

── The fix ──────────────────────────────────────────────────
Change: display: block;
To:     display: flex;

That single word switches the container from vertical stacking to horizontal layout.`,
      lessonSummary: `You changed display: block to display: flex — and the vertical stack became a horizontal row. 🎉

That single word is the most important CSS discovery you will make as a beginner.

Here is exactly what happened:
  display: block  →  each item occupies the full container width and stacks
  display: flex   →  children automatically line up side by side in a row

Flexbox is used on virtually every modern website for layout:
  Navigation bars      → items side by side
  Card grids           → cards in a row that wrap on small screens
  Hero sections        → text on the left, image on the right
  Button rows          → icon + label aligned vertically
  Centring things      → justify-content: center + align-items: center

Before Flexbox existed (before 2012), developers used floats, position: absolute, and
inline-block hacks to build horizontal layouts. It was miserable and error-prone.
Flexbox replaced decades of CSS headaches with something that actually makes sense.

Experiment now: add justify-content: space-between to the nav rule and watch
the links spread to opposite ends. That is the power of one more property. 🧪

You now have the key to every horizontal layout in CSS. Use it constantly.`,
      brokenCode: `nav {
  display: block;
  gap: 16px;
  padding: 16px 24px;
  background: #1a1a2e;
}

nav a {
  color: #e2e8f0;
  text-decoration: none;
  font-size: 16px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255,255,255,0.07);
}

/* Change the display value on nav to make links sit side by side */`,
      validationMode: 'contains',
      validationRules: {
        mustContain: ['display: flex'],
        mustNotContain: ['display: block'],
        ignoreCase: true,
        ignoreWhitespace: false,
      },
    },
  },
  // ── CSS 2: Centre a Button ────────────────────────────────────────────────
  {
    id: 'css-center',
    name: 'Centre a Button',
    track: 'CSS Layout',
    trackIcon: '🎨',
    description: 'Horizontally centre a button using display: block and margin: 0 auto.',
    data: {
      language: 'css',
      track: 'CSS Layout',
      trackOrder: 1,
      concepts: ['CSS', 'box model', 'margin auto', 'centering', 'display block'],
      scenario: 'The hero section\'s call-to-action button is stuck to the left edge of its container. It needs to be perfectly centred. The designer is watching. Two CSS declarations are all you need.',
      theory: `── The CSS Box Model ─────────────────────────────────────────
Before you can understand centering, you need to understand how CSS treats every element.

Every element is a RECTANGULAR BOX made of four layers, from inside to outside:

  ┌──────────────────────────────────────────┐
  │              MARGIN                      │  ← invisible space outside the border
  │  ┌────────────────────────────────────┐  │
  │  │            BORDER                  │  │  ← the visible edge (if you set one)
  │  │  ┌──────────────────────────────┐  │  │
  │  │  │          PADDING             │  │  │  ← space INSIDE the border
  │  │  │  ┌────────────────────────┐  │  │  │
  │  │  │  │       CONTENT          │  │  │  │  ← your text, image, etc.
  │  │  │  └────────────────────────┘  │  │  │
  │  │  └──────────────────────────────┘  │  │
  │  └────────────────────────────────────┘  │
  └──────────────────────────────────────────┘

  padding  — pushes content AWAY FROM the border (space inside)
  border   — the visible line around the element
  margin   — pushes OTHER ELEMENTS away (space outside)

Understanding the box model is essential — nearly every CSS layout problem
is a question of which layer you need to adjust.

── display: block vs display: inline ───────────────────────
A <button> element is display: inline by default.
Inline elements:
  • Only take up as much width as their content
  • Ignore top/bottom margin
  • Cannot be centred with margin: auto

To centre using margin: auto, you must first make the element display: block.
A block element:
  • Takes up the full width of its container (unless you constrain it)
  • Honours all margins, including auto margins

── How margin: auto works ───────────────────────────────────
When you set margin: 0 auto on a block element, here is what happens:

  margin: 0 auto
          ↑   ↑
          │   └── LEFT and RIGHT margin = auto
          └─────── TOP and BOTTOM margin = 0

"auto" tells the browser: "calculate how much space is left over in the container
after this element, and assign it all to this margin side."

When BOTH left and right are auto, the browser splits the leftover space equally:
left auto = [  ½ of remaining space  ]  [element]  [  ½ of remaining space  ] = right auto

The element ends up perfectly centred. ✓

── Step by step ─────────────────────────────────────────────
.cta {
  display: block;       /* step 1: make it a block element */
  width: fit-content;   /* step 2: shrink to its content width (not full-width)  */
  margin: 0 auto;       /* step 3: split remaining space equally left and right  */
}

── Important: the element must be narrower than its container ──
margin: auto only works if there IS leftover space to split.
If the element is 100% wide (full width), there is nothing left to distribute.
That is why width: fit-content or a fixed pixel width is required.

── Modern alternative ───────────────────────────────────────
You can also centre by putting Flexbox on the PARENT container:
  .hero {
    display: flex;
    justify-content: center;
  }
Both approaches are correct. margin: auto is classic; Flexbox is modern.`,
      lessonSummary: `You added display: block and margin: 0 auto to centre the button. It is now perfectly positioned. 🎉

Let's cement exactly why this works:

1. display: block
   The button is inline by default — it sits in the text flow and ignores auto margins.
   Changing it to block makes it participate in block layout, where margin: auto is meaningful.

2. margin: 0 auto
   "0" = no top or bottom margin
   "auto" on both left and right = browser divides remaining horizontal space equally
   Equal space on both sides = centred

This pattern applies to FAR more than just buttons. It is how every website with a content
column centres its entire layout:

  .page-wrapper {
    max-width: 1200px;
    margin: 0 auto;      ← this centres the entire page content
  }

That is the exact CSS pattern used by virtually every website you have ever visited.
Now you know precisely how it works — not just that it works.

You now understand:
  ✓ The CSS box model (margin, border, padding, content)
  ✓ The difference between display: block and display: inline
  ✓ How margin: auto distributes space
  ✓ How to centre any block element on the page

These fundamentals sit underneath every CSS layout you will ever build. 💡`,
      brokenCode: `body {
  font-family: sans-serif;
  padding: 60px 20px;
  background: #0f172a;
  color: #e2e8f0;
}

.hero {
  background: #1e293b;
  padding: 60px 40px;
  border-radius: 12px;
  text-align: center;
}

.cta {
  background: #6366f1;
  color: white;
  padding: 14px 36px;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  /* Add two properties here to centre this button */
}`,
      validationMode: 'contains',
      validationRules: {
        mustContain: ['margin: 0 auto', 'display: block'],
        ignoreCase: true,
        ignoreWhitespace: false,
      },
    },
  },
  // ── JS 0: Let vs Const ────────────────────────────────────────────────────
  {
    id: 'js-variables',
    name: 'Let vs Const',
    track: 'JS Fundamentals',
    trackIcon: '⚡',
    description: 'Fix a TypeError — a const variable is being reassigned where let should be used.',
    data: {
      language: 'javascript',
      track: 'JS Fundamentals',
      trackOrder: 1,
      concepts: ['JavaScript', 'variables', 'let', 'const', 'TypeError', 'declarations'],
      scenario: 'The score counter looks perfect but throws an error the moment you click the button. The console says "Assignment to constant variable." You\'ve found your culprit — now hunt down the wrong declaration and fix it.',
      theory: `── What is JavaScript? ──────────────────────────────────────
If HTML is the skeleton of a page and CSS is the visual style, JavaScript is the BEHAVIOUR.

JavaScript makes webpages interactive:
  Buttons that do things when clicked
  Forms that validate before submission
  Content that updates without reloading the page
  Saving data, loading data, running games — all JavaScript

── What is a variable? ─────────────────────────────────────
A VARIABLE is a named container for storing a value in memory.

Think of it as a labelled box:
  → You write a name on the box (the variable name)
  → You put something inside (the value)
  → Later, you can look inside and read the value
  → And depending on the type of box, you may or may not be able to swap the contents

── The three ways to declare a variable ────────────────────
Modern JavaScript (ES2015, also called ES6) introduced two keywords:

  const
    Short for "constant". Once you put something in the box, the box is SEALED.
    You can READ the value, but you CANNOT reassign it.
    If you try to reassign a const variable, JavaScript throws a TypeError immediately.

    const pi = 3.14159;
    const siteName = 'PuzzleWarz';
    pi = 3;    ← TypeError: Assignment to constant variable. 🚫

  let
    The box STAYS OPEN. You can replace the contents at any time.
    Use let for values that are expected to change over time.

    let score = 0;
    score = score + 1;    ← works perfectly ✓
    let currentUser = null;
    currentUser = 'alice@example.com';    ← works perfectly ✓

  var (the old keyword — avoid it)
    Works similarly to let, but with confusing "hoisting" and scoping behaviours.
    All modern JavaScript code uses const and let. Never use var in new code.

── The golden rule ──────────────────────────────────────────
  DEFAULT to const for everything.
  Switch to let ONLY when you know the value will be reassigned.

This makes your code easier to understand at a glance:
  If you see const → this value never changes. You can trust it.
  If you see let   → this value might change somewhere below. Stay alert.

── When const does NOT mean "immutable" ─────────────────────
An important nuance: const prevents REASSIGNMENT of the variable itself,
but it does NOT prevent changes to the CONTENTS of objects or arrays:

  const user = { name: 'Alice', score: 0 };
  user.score = 100;     ← ✓ allowed: you changed a property, not the variable
  user = { name: 'Bob' }; ← 🚫 TypeError: you tried to reassign the variable

For now, remember: const = don't reassign. let = can reassign.

── The bug in this puzzle ───────────────────────────────────
The score starts at 0 with const count = 0.
The click handler then tries to do count = count + 1.
But count was declared with const — you cannot reassign it.

JavaScript throws:  TypeError: Assignment to constant variable.

The fix: change const count to let count.`,
      lessonSummary: `You changed const count to let count — and the counter works without errors. 🎉

Here is exactly what you fixed:
  const count = 0;       ← the box is sealed. count can never be reassigned.
  ↓ change to ↓
  let count = 0;         ← the box is open. count can be updated anytime.

The mental model to carry with you forever:
  const = sealed box.    Perfect for values that should NEVER change.
  let   = open box.      Required for values that WILL change.

Real-world examples of each:
  const TAX_RATE = 0.2;          ← tax rate doesn't change mid-function
  const API_URL = 'https://...'; ← the URL is fixed
  let   cartTotal = 0;           ← the total grows as items are added
  let   currentPage = 1;         ← the page changes as the user navigates

Best practice:
  1. Write const by default
  2. If you get "Assignment to constant variable" — it means JavaScript is telling
     you that value needs to change. Switch that specific variable to let.
  3. Never use var in modern code.

You now understand one of the absolute cornerstones of JavaScript.
Every single piece of JavaScript ever written uses variables.
You've got this one right. 🏆`,
      brokenCode: `const app = document.getElementById('app');
app.innerHTML =
  '<h2 style="font-family:sans-serif;color:#e2e8f0;margin-bottom:12px">Score Counter</h2>' +
  '<button id="score-btn" style="padding:10px 24px;font-size:16px;cursor:pointer;border-radius:6px;background:#6366f1;color:white;border:none">+ Add Point</button>' +
  '<p style="font-family:sans-serif;font-size:22px;color:#e2e8f0;margin-top:16px">Score: <strong id="score-display">0</strong></p>';

// BUG: const cannot be reassigned — change it to the correct keyword
const count = 0;

const btn = document.getElementById('score-btn');
const display = document.getElementById('score-display');

btn.addEventListener('click', function () {
  count = count + 1;
  display.textContent = count;
});`,
      validationMode: 'contains',
      validationRules: {
        mustContain: ['let count'],
        mustNotContain: ['const count = 0'],
        ignoreCase: false,
        ignoreWhitespace: false,
      },
    },
  },
  // ── JS 1: Fix the Typo ────────────────────────────────────────────────────
  {
    id: 'js-typo',
    name: 'Fix the Typo',
    track: 'JS DOM',
    trackIcon: '⚡',
    description: 'A click handler is dead — the event name is misspelled. Find it and fix it.',
    data: {
      language: 'javascript',
      track: 'JS DOM',
      trackOrder: 1,
      concepts: ['JavaScript', 'DOM', 'events', 'addEventListener', 'debugging'],
      scenario: 'The click counter looks perfect — styled button, number display, clean code. But clicking the button does absolutely nothing. No error in the console, nothing. The bug is invisible unless you know where to look.',
      theory: `── What is JavaScript for? ──────────────────────────────────
If HTML is the skeleton and CSS is the appearance, JavaScript is the BEHAVIOUR.

JavaScript makes webpages interactive:
  Buttons that do things when you click them
  Forms that validate before you submit
  Content that updates without reloading the page
  Shopping carts, games, chat apps, live score boards — all JavaScript

── What is the DOM? ─────────────────────────────────────────
When your browser loads an HTML file, it does not just display it.
It builds a live, interactive tree structure in memory called the
Document Object Model (DOM).

JavaScript can read and modify this tree:
  // Find an element by its id attribute
  const btn = document.getElementById('my-button');

  // Find an element by CSS selector
  const heading = document.querySelector('h1');

Once you have a reference to an element, you can change it:
  heading.textContent = 'New Title';       ← change text
  heading.style.color = 'red';             ← change a CSS property
  heading.innerHTML = '<em>Italic</em>';   ← change inner HTML

── What are Events? ─────────────────────────────────────────
An EVENT is something that happens — most commonly a user action.

The browser fires events constantly:
  User clicks a button      → 'click' event fires on the button
  User types a character    → 'keydown' event fires on the window
  User submits a form       → 'submit' event fires on the form
  Page finishes loading     → 'load' event fires on the window

── addEventListener ─────────────────────────────────────────
You use addEventListener to tell JavaScript: "when THIS event happens
on THIS element, run THIS function."

  element.addEventListener(eventType, callbackFunction);

  ↑ element          — the DOM element to watch
  ↑ eventType        — WHAT to listen for, as a string
  ↑ callbackFunction — a function that runs when the event fires

Example:
  const btn = document.getElementById('my-btn');

  btn.addEventListener('click', function () {
    console.log('Button was clicked!');
  });

── The most important event types to memorise ───────────────
These are all exact strings — every character matters:

  'click'       — mouse click or screen tap
  'dblclick'    — double click
  'keydown'     — any key pressed (fires while held)
  'keyup'       — any key released
  'input'       — text input changed (instant, every keystroke)
  'change'      — input value changed and focus has left
  'submit'      — form submitted (Enter key or submit button)
  'mouseover'   — cursor enters the element
  'mouseout'    — cursor leaves the element
  'focus'       — element receives keyboard/tab focus
  'blur'        — element loses focus
  'load'        — page or image has finished loading
  'scroll'      — user has scrolled the element or window

── The silent bug ───────────────────────────────────────────
If you misspell the event name, JavaScript does NOT throw an error.
It silently attaches a listener to an event that will NEVER fire.

  btn.addEventListener('klick', handler);   ← attaches, but 'klick' never fires
  btn.addEventListener('click', handler);   ← fires on every click ✓

This is one of the most confusing beginner bugs because there is no
error message, no warning, nothing in the console. The code just... does nothing.

The fix: check the event name spelling first.`,
      lessonSummary: `You found the misspelled event name — 'klick' → 'click' — and the counter now works. 🎉

This bug teaches one of the most important debugging instincts in all of programming:

  "My code runs without errors — it just doesn't DO anything."

When a click handler is dead, check these four things in order:
  1. Is the event name spelled correctly? ('click' not 'klick')
  2. Did getElementById/querySelector find the right element? (log it: console.log(btn))
  3. Is the code running at the right time? (is the element in the DOM yet when the listener is set up?)
  4. Is the function doing what you think? (add console.log('handler fired') inside it)

The habit of checking event name spelling first will save you hours over your career.

Here is the bigger picture of what you now understand:
The fundamental pattern that makes every interactive website work:
  1. Get an element from the DOM      document.getElementById(...)
  2. Listen for an event              .addEventListener('click', ...)
  3. Run a function that changes the page   function() { ... }

Every button on every website, every to-do list toggle, every live search box,
every game control — all of them are this exact same pattern.

You have it. Go build something. 🚀`,
      brokenCode: `// Build the counter UI
const app = document.getElementById('app');
app.innerHTML =
  '<button id="counter-btn" style="padding:12px 28px;font-size:18px;cursor:pointer;border-radius:6px;background:#6366f1;color:white;border:none">Click me!</button>' +
  '<p style="font-family:sans-serif;font-size:24px;margin-top:16px;color:#e2e8f0">Count: <strong id="count-display">0</strong></p>';

let count = 0;
const btn = document.getElementById('counter-btn');
const display = document.getElementById('count-display');

// BUG: the event name is misspelled — fix it so the handler fires
btn.addEventListener('klick', function () {
  count = count + 1;
  display.textContent = count;
});`,
      validationMode: 'contains',
      validationRules: {
        mustContain: ["'click'"],
        mustNotContain: ["'klick'"],
        ignoreCase: true,
        ignoreWhitespace: false,
      },
    },
  },
  // ── JS 2: Wrong Operator Bug ───────────────────────────────────────────────
  {
    id: 'js-operator',
    name: 'Wrong Operator Bug',
    track: 'JS Fundamentals',
    trackIcon: '⚡',
    description: 'A function uses + instead of * — fix the maths operator to get the right area.',
    data: {
      language: 'javascript',
      track: 'JS Fundamentals',
      trackOrder: 2,
      concepts: ['JavaScript', 'functions', 'arithmetic operators', 'logic bugs', 'debugging'],
      scenario: 'The circle area calculator is running and showing numbers — but every answer is completely wrong. The code has no errors. There is no crash. The bug is purely in the maths. Spot what the formula is doing vs what it should do.',
      theory: `── What is a function? ──────────────────────────────────────
A FUNCTION is a reusable block of code that performs a specific task.

You DEFINE a function once:
  function greet(name) {
    return 'Hello, ' + name + '!';
  }

Then you CALL it as many times as you need:
  greet('Alice')   → 'Hello, Alice!'
  greet('Bob')     → 'Hello, Bob!'
  greet('World')   → 'Hello, World!'

Parts of a function:

  function  ← keyword: "I am defining a function"
  greet     ← the name you give this function
  (name)    ← PARAMETER: an input the function accepts (like a variable)
  { ... }   ← BODY: the code that runs when the function is called
  return    ← sends a value BACK to whoever called the function

Functions prevent repetition. Instead of writing the same logic ten times,
you write it once and call it ten times.

── JavaScript arithmetic operators ──────────────────────────
JavaScript does maths. The symbols are mostly familiar from school:

  Symbol  Operation               Example         Result
  ──────────────────────────────────────────────────────────
    +     Addition                5 + 3           8
    -     Subtraction             10 - 4          6
    *     Multiplication          4 * 7           28
    /     Division                20 / 5          4
    **    Exponentiation          2 ** 8          256  (2 to the power of 8)
    %     Remainder (modulo)      17 % 5          2    (leftover after dividing 17 ÷ 5)

Important trap: + also concatenates strings:
  1 + 2         → 3        (number + number = number)
  '1' + 2       → '12'     (string + number = string — JavaScript converts the number!)
  1 + '2'       → '12'     (same — string wins)

That last point trips up intermediate developers regularly. Keep it in mind.

── The area of a circle ─────────────────────────────────────
Mathematics formula:  A = π × r²
In English:           Area = Pi MULTIPLIED BY radius SQUARED

In JavaScript:
  return Math.PI * radius * radius;
  // or equivalently:
  return Math.PI * radius ** 2;

Math.PI is a built-in JavaScript constant: approximately 3.14159265358979...

── The bug in this puzzle ───────────────────────────────────
The function is written like this:
  return Math.PI + radius + radius;
              ↑           ↑
           addition!    addition!

For radius = 5, this gives:
  3.14159 + 5 + 5 = 13.14   ← completely wrong

The correct answer is:
  3.14159 × 5 × 5 = 78.54   ← multiply, not add

The operators + and * look very similar at a glance — easy to type wrong.

── Logic bugs vs syntax errors ──────────────────────────────
A SYNTAX ERROR means you broke JavaScript's grammar rules.
The browser refuses to run the code at all. You see a red error in the console.

A LOGIC BUG means the code runs perfectly — but produces the WRONG answer.
JavaScript has no idea the maths is wrong. Only you can catch it by testing.

This is why developers ALWAYS test functions with inputs where they KNOW the expected output:
  calculateArea(5)  should return approximately 78.54
  calculateArea(1)  should return approximately 3.14  (a circle with radius 1 has area π)
  calculateArea(0)  should return 0

If the output doesn't match → the logic is wrong somewhere.`,
      lessonSummary: `You swapped + for * and the formula now returns the correct area. 🎉

What made this bug sneaky:
  • The code ran without any errors — JavaScript had no idea + was wrong
  • The function returned a NUMBER — just completely the wrong number
  • Without testing against known values (78.54 for radius 5), this bug stays invisible forever

This is a LOGIC BUG — valid JavaScript that does the wrong thing.

The debugging skill you just practised:
  → Test your functions with inputs where you KNOW the expected output
  → If the output doesn't match, the bug is in your logic or maths
  → Work backwards: what operation would produce the WRONG number you're seeing?
     3.14159 + 5 + 5 = 13.14  →  the + symbols gave it away

Understanding the difference between + and * might seem trivial — but the
extra confusion is that + also does string concatenation. Many bugs in real
production code come down to "I thought JavaScript would treat this as a number
but it treated it as a string." Testing saves you every time.

You have now experienced the core of the debugging mindset:
  Don't just ask "does it run?"
  Ask "does it produce the RIGHT answer?"

That distinction is what separates a developer who ships quality code from one who ships bugs. 🧠`,
      brokenCode: `// Build the demo UI
const app = document.getElementById('app');

function calculateArea(radius) {
  // BUG: wrong operator — this adds instead of multiplying
  return Math.PI + radius + radius;
}

app.innerHTML =
  '<h2 style="font-family:sans-serif;color:#e2e8f0">Circle Area Calculator</h2>' +
  '<p style="font-family:sans-serif;color:#e2e8f0">area(5) = ' + calculateArea(5).toFixed(2) + ' (correct answer: 78.54)</p>' +
  '<p style="font-family:sans-serif;color:#e2e8f0">area(3) = ' + calculateArea(3).toFixed(2) + ' (correct answer: 28.27)</p>' +
  '<p style="font-family:sans-serif;color:#e2e8f0">area(1) = ' + calculateArea(1).toFixed(2) + ' (correct answer: 3.14)</p>';`,
      validationMode: 'regex',
      validationRules: {
        regex: 'math\\.pi\\s*\\*\\s*radius\\s*\\*\\s*radius|math\\.pi\\s*\\*\\s*radius\\s*\\*\\*\\s*2',
        ignoreCase: true,
        ignoreWhitespace: false,
      },
    },
  },
];

interface PuzzleTypeFieldsProps {
  puzzleType: string;
  puzzleData: Record<string, unknown>;
  onDataChange: (key: string, value: unknown) => void;
}

export default function PuzzleTypeFields({ puzzleType, puzzleData, onDataChange }: PuzzleTypeFieldsProps) {
  const [detectiveJson, setDetectiveJson] = useState<string>('');
  const [detectiveJsonError, setDetectiveJsonError] = useState<string>('');
  const [dcNoirTitle, setDcNoirTitle] = useState('');
  const [dcIntro, setDcIntro] = useState('');
  const [dcPrologueText, setDcPrologueText] = useState('');
  const [dcNarratorName, setDcNarratorName] = useState('');
  const [dcNarratorVoice, setDcNarratorVoice] = useState('');
  const [dcPrologueBgImage, setDcPrologueBgImage] = useState('');
  const [dcPrologueBgVideo, setDcPrologueBgVideo] = useState('');
  const [dcPrologueAudio, setDcPrologueAudio] = useState('');
  const [dcPrologueAudioLoop, setDcPrologueAudioLoop] = useState(false);
  const [crimeCaseJson, setCrimeCaseJson] = useState<string>('');
  const [crimeCaseJsonError, setCrimeCaseJsonError] = useState<string>('');
  const [parasiteCodeJson, setParasiteCodeJson] = useState<string>('');
  const [parasiteCodeJsonError, setParasiteCodeJsonError] = useState<string>('');
  const [gridlockFileJson, setGridlockFileJson] = useState<string>('');
  const [gridlockFileJsonError, setGridlockFileJsonError] = useState<string>('');
  const [vaultJson, setVaultJson] = useState<string>('');
  const [vaultJsonError, setVaultJsonError] = useState<string>('');
  const [debriefJson, setDebriefJson] = useState<string>('');
  const [debriefJsonError, setDebriefJsonError] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [templateConfirm, setTemplateConfirm] = useState(false);
  const [wsGenerateCount, setWsGenerateCount] = useState(8);
  const [wsGenerating, setWsGenerating] = useState(false);
  const [wsGenerateError, setWsGenerateError] = useState('');

  useEffect(() => {
    if (puzzleType !== 'detective_case') return;

    const existing = (puzzleData as any)?.detectiveCase;
    const template = {
      noirTitle: 'The Blackout Ledger',
      intro: 'A city that never sleeps has secrets it never tells.',
      prologue: {
        text: "It was a Tuesday. The kind that feels like a Monday that gave up.\n\nThe envelope was on my desk when I got in — no stamp, no return address, just a name inside. The name of someone I hadn't heard in six years.\n\nI probably should've walked away. But I never could resist a case that walked through my door uninvited.",
        narratorName: 'Det. Ray Voss',
        narratorVoice: 'gravel',
      },
      lockMode: 'fail_once',
      stages: [
        {
          id: 'scene',
          title: 'The Scene',
          prompt: 'A matchbook sits in the ashtray. One word is scratched into the cover. Submit it.',
          kind: 'text',
          expectedAnswer: 'EMBER-11',
          ignoreCase: true,
          ignoreWhitespace: true,
        },
        {
          id: 'matchbook',
          title: 'The Matchbook',
          prompt: 'On the inside flap: “11:07 Special”. The bartender knows the code. Submit it.',
          kind: 'text',
          expectedAnswer: 'ECLIPSE-3',
          ignoreCase: true,
          ignoreWhitespace: true,
        },
        {
          id: 'ledger',
          title: 'The Ledger',
          prompt: 'The carbon copy bleeds through. A number keeps showing up. Submit it.',
          kind: 'text',
          expectedAnswer: 'CARBON-9',
          ignoreCase: true,
          ignoreWhitespace: true,
        },
      ],
    };

    try {
      const next = existing && typeof existing === 'object' ? existing : template;
      setDcNoirTitle(next.noirTitle ?? '');
      setDcIntro(next.intro ?? '');
      setDcPrologueText(next.prologue?.text ?? '');
      setDcNarratorName(next.prologue?.narratorName ?? '');
      setDcNarratorVoice(next.prologue?.narratorVoice ?? '');
      setDcPrologueBgImage(next.prologue?.backgroundImage ?? '');
      setDcPrologueBgVideo(next.prologue?.backgroundVideo ?? '');
      setDcPrologueAudio(next.prologue?.audio ?? '');
      setDcPrologueAudioLoop(next.prologue?.audioLoop ?? false);
      setDetectiveJson(JSON.stringify(next.stages ?? [], null, 2));
      setDetectiveJsonError('');
      onDataChange('detectiveCase', next);
    } catch {
      setDcNoirTitle(template.noirTitle);
      setDcIntro(template.intro);
      setDcPrologueText(template.prologue.text);
      setDcNarratorName(template.prologue.narratorName);
      setDcNarratorVoice(template.prologue.narratorVoice);
      setDcPrologueBgImage('');
      setDcPrologueBgVideo('');
      setDcPrologueAudio('');
      setDcPrologueAudioLoop(false);
      setDetectiveJson(JSON.stringify(template.stages, null, 2));
      setDetectiveJsonError('');
      onDataChange('detectiveCase', template);
    }
    // Only reset when switching types or when a new puzzleData object is passed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleType]);

  useEffect(() => {
    if (puzzleType !== 'jim_wyze_case') return;

    const raw = puzzleData as any;
    const existingDesignerData = raw?.escapeRoomData;
    const hasDesignerScenes = Array.isArray(existingDesignerData?.scenes) && existingDesignerData.scenes.length > 0;
    const hasPersistedRooms = Array.isArray(raw?.rooms) && raw.rooms.length > 0;

    if (hasDesignerScenes || hasPersistedRooms) return;

    const starter = {
      title: 'Jim Wyze Case 01: The Ashen Ledger',
      description: 'Detective Jim Wyze follows a trail of coded evidence through a smoke-stained office and a locked archive room.',
      minTeamSize: 1,
      maxTeamSize: 1,
      intro: {
        title: 'Case Briefing',
        bodyText: 'Rain chewed at the city windows when Detective Jim Wyze got the call. A missing ledger, a dead informant, and three locations tied together by a single symbol. Search the scene, collect evidence, and crack every lock before the trail goes cold.',
        skipAllowed: true,
        skipDelaySeconds: 3,
      },
      scenes: [],
    };

    onDataChange('escapeRoomData', starter);
    // Initialize only when the puzzle type switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleType]);
  const asString = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback;
  };

  const asNumber = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  };

  const asNumberOrEmpty = (value: unknown): number | '' => {
    if (value == null || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return '';
  };

  const asStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string') as string[];
    if (typeof value === 'string') {
      return value
        .split(/\r?\n|,/g)
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [];
  };

  const updateValidationRule = (key: string, value: unknown) => {
    const existing = (puzzleData.validationRules && typeof puzzleData.validationRules === 'object')
      ? (puzzleData.validationRules as Record<string, unknown>)
      : {};
    onDataChange('validationRules', { ...existing, [key]: value });
  };

  // ── Jigsaw shape preview — pure SVG, redraws on every React render ───────
  function buildJigsawSVGPath(extFrac: number, rFrac: number, nHalfFrac: number, shoulderStart: number): string {
    // Preview: 200×200, piece body 60→140 (80px each side, 30px margin for tabs)
    const x0 = 60, y0 = 60, x1 = 140, y1 = 140;
    const pw = 80, ph = 80;
    const K = 0.5523;

    function edgePts(L: number, dir: number): number[] {
      const sign  = dir;
      const ext   = L * extFrac;
      const r     = L * rFrac;
      const kCYm  = Math.max(ext - r, r * 0.05);
      const kCY   = sign * kCYm;
      const tabH  = sign * ext;
      const kL    = L * 0.5 - r;
      const kR    = L * 0.5 + r;
      const nHalf = L * nHalfFrac;
      const nL    = L * 0.5 - nHalf;
      const nR    = L * 0.5 + nHalf;
      const nY    = -sign * L * 0.018;
      const fL2   = L * Math.min(shoulderStart, nL / L - 0.01);
      const fR2   = L - fL2;
      const sa    = (nL - fL2) * 0.65;
      const si    = (nL - fL2) * 0.20;
      const nRise = sign * (kCY - nY) * 0.35;
      // Returns flat array: [along0,out0, cp1a,cp1o,cp2a,cp2o,ena,eno, ... × 6 beziers, L,0]
      return [
        fL2, 0,
        fL2+sa, sign*L*0.012,   nL-si, nY,              nL, nY,
        nL,     nY+(kCY-nY)*0.42, kL, kCY-nRise,        kL, kCY,
        kL,     kCY+sign*r*K,   L*0.5-r*K, tabH,        L*0.5, tabH,
        L*0.5+r*K, tabH,        kR, kCY+sign*r*K,        kR, kCY,
        kR,     kCY-nRise,      nR, nY+(kCY-nY)*0.42,   nR, nY,
        nR+si,  nY,             fR2-sa, sign*L*0.012,    fR2, 0,
        L, 0,
      ];
    }

    const f = (n: number) => Math.round(n * 100) / 100;

    // Edge transformer helpers
    // top:    world = (x0+along, y0-out)   dir=+1 → tab up
    // right:  world = (x1+out,  y0+along)  dir=+1 → tab right
    // bottom: world = (x1-along, y1+out)   dir=-1 → slot up (out is negative)
    // left:   world = (x0-out,  y1-along)  dir=-1 → slot right (out is negative)
    function pts2svg(pts: number[], edge: 'top'|'right'|'bottom'|'left'): string[] {
      const p = (ai: number, oi: number): string => {
        const a = pts[ai], o = pts[oi];
        let wx = 0, wy = 0;
        if (edge === 'top')    { wx = x0 + a; wy = y0 - o; }
        if (edge === 'right')  { wx = x1 + o; wy = y0 + a; }
        if (edge === 'bottom') { wx = x1 - a; wy = y1 + o; }
        if (edge === 'left')   { wx = x0 - o; wy = y1 - a; }
        return `${f(wx)},${f(wy)}`;
      };
      const cmds: string[] = [];
      cmds.push(`L ${p(0, 1)}`);
      for (let i = 0; i < 6; i++) {
        const b = 2 + i * 6;
        cmds.push(`C ${p(b,b+1)} ${p(b+2,b+3)} ${p(b+4,b+5)}`);
      }
      cmds.push(`L ${p(38, 39)}`);
      return cmds;
    }

    const top    = edgePts(pw, +1);
    const right  = edgePts(ph, +1);
    const bottom = edgePts(pw, -1);
    const left   = edgePts(ph, -1);

    return [
      `M ${x0},${y0}`,
      ...pts2svg(top,    'top'),
      ...pts2svg(right,  'right'),
      ...pts2svg(bottom, 'bottom'),
      ...pts2svg(left,   'left'),
      'Z',
    ].join(' ');
  }

  const renderJigsawFields = () => {
    const extFrac       = Number(puzzleData.pieceExtFrac       ?? 0.280);
    const rFrac         = Number(puzzleData.pieceRFrac         ?? 0.140);
    const nHalfFrac     = Number(puzzleData.pieceNHalfFrac     ?? 0.095);
    const shoulderStart = Number(puzzleData.pieceShoulderStart ?? 0.050);
    const svgPath = buildJigsawSVGPath(extFrac, rFrac, nHalfFrac, shoulderStart);

    return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Grid Rows</label>
          <input
            type="number"
            min={2}
            max={50}
            value={asNumber(puzzleData.gridRows, 3)}
            onChange={(e) => onDataChange('gridRows', parseInt(e.target.value, 10))}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Grid Cols</label>
          <input
            type="number"
            min={2}
            max={50}
            value={asNumber(puzzleData.gridCols, 4)}
            onChange={(e) => onDataChange('gridCols', parseInt(e.target.value, 10))}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Snap Tolerance (px)</label>
        <input
          type="number"
          min={1}
          max={100}
          value={asNumber(puzzleData.snapTolerance, 12)}
          onChange={(e) => onDataChange('snapTolerance', parseInt(e.target.value, 10))}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        />
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={Boolean(puzzleData.rotationEnabled)}
          onChange={(e) => onDataChange('rotationEnabled', e.target.checked)}
          className="h-4 w-4"
        />
        Rotation Enabled
      </label>

      {/* ── Piece Shape Designer ────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-blue-300">🧩 Piece Shape Designer</span>
          <span className="text-xs text-gray-400">— drag sliders to reshape pieces in real time</span>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* SVG preview — React re-renders this automatically on every slider change */}
          <div className="flex-shrink-0">
            <svg
              viewBox="0 0 200 200"
              width={200}
              height={200}
              className="rounded-lg bg-slate-800 border border-slate-600"
            >
              {/* faint body rect for reference */}
              <rect x={60} y={60} width={80} height={80} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
              <path d={svgPath} fill="rgba(96,165,250,0.10)" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-gray-500 mt-1 text-center">Live preview</p>
          </div>

          {/* Sliders */}
          <div className="flex-1 space-y-4 w-full">
            {([
              { key: 'pieceExtFrac',       label: 'Tab Depth',       value: extFrac,       min: 0.15, max: 0.40, step: 0.005, fmt: (v: number) => `${Math.round(v*100)}%` },
              { key: 'pieceRFrac',         label: 'Knob Radius',     value: rFrac,         min: 0.06, max: 0.20, step: 0.002, fmt: (v: number) => `${Math.round(v*100)}%` },
              { key: 'pieceNHalfFrac',     label: 'Neck Half-Width', value: nHalfFrac,     min: 0.04, max: 0.22, step: 0.002, fmt: (v: number) => `${Math.round(v*200)}% wide` },
              { key: 'pieceShoulderStart', label: 'Shoulder Start',  value: shoulderStart, min: 0.05, max: 0.28, step: 0.005, fmt: (v: number) => `${Math.round(v*100)}% in` },
            ] as Array<{ key: string; label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string }>).map(({ key, label, value, min, max, step, fmt }) => (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-300">{label}</label>
                  <span className="text-xs text-blue-300 font-mono">{fmt(value)}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => {
                    onDataChange(key, parseFloat(e.target.value));
                  }}
                  className="w-full h-2 rounded-full appearance-none bg-slate-600 accent-blue-400"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                onDataChange('pieceExtFrac', 0.280);
                onDataChange('pieceRFrac', 0.140);
                onDataChange('pieceNHalfFrac', 0.095);
                onDataChange('pieceShoulderStart', 0.050);
              }}
              className="text-xs px-3 py-1.5 rounded bg-slate-600 hover:bg-slate-500 text-gray-300"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </div>

      {/* ── Fun Fact ────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">
          Fun Fact <span className="text-xs font-normal text-gray-500">(shown after solve)</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Share an interesting fact about the subject of this puzzle image. Displayed to the player on completion.</p>
        <textarea
          value={asString(puzzleData.funFact, '')}
          onChange={(e) => onDataChange('funFact', e.target.value)}
          placeholder="e.g. The Eiffel Tower grows up to 15cm taller in summer due to thermal expansion of the iron."
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24 resize-y"
        />
      </div>
    </div>
    );
  };

  const renderCodeMasterFields = () => (
    <div className="space-y-4">

      {/* ── 🚀 Starter Templates ─────────────────────────────── */}
      <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base font-semibold text-indigo-300">🚀 Starter Templates</span>
          <span className="text-xs text-gray-400">— load a ready-made puzzle and customise it</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
          {CODE_MASTER_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => { setTemplateId(tpl.id); setTemplateConfirm(false); }}
              className={`text-left rounded-lg border p-3 transition-all ${
                templateId === tpl.id
                  ? 'border-indigo-400 bg-indigo-500/20'
                  : 'border-slate-600 bg-slate-700/40 hover:border-indigo-500/60 hover:bg-slate-700/70'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{tpl.trackIcon}</span>
                <span className="text-xs font-semibold text-indigo-300">{tpl.track}</span>
              </div>
              <div className="text-sm font-semibold text-white mb-0.5">{tpl.name}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{tpl.description}</div>
            </button>
          ))}
        </div>
        {templateId && !templateConfirm && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-sm text-amber-200 flex-1">
              ⚠️ Loading <strong>{CODE_MASTER_TEMPLATES.find(t => t.id === templateId)?.name}</strong> will overwrite the fields below. Continue?
            </span>
            <button
              type="button"
              onClick={() => {
                const tpl = CODE_MASTER_TEMPLATES.find(t => t.id === templateId);
                if (tpl) {
                  Object.entries(tpl.data).forEach(([key, value]) => onDataChange(key, value));
                }
                setTemplateConfirm(true);
              }}
              className="px-3 py-1.5 rounded text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
            >
              Yes, load it
            </button>
            <button
              type="button"
              onClick={() => setTemplateId('')}
              className="px-3 py-1.5 rounded text-sm bg-slate-600 hover:bg-slate-500 text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
        {templateId && templateConfirm && (
          <div className="p-2 text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg">
            ✅ Template loaded — edit the fields below, set the <strong>Title</strong> at the top, then click Create Puzzle.
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Learning Track</label>
          <select
            value={asString(puzzleData.track, '')}
            onChange={(e) => onDataChange('track', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          >
            <option value="">— None / standalone —</option>
            <optgroup label="HTML">
              <option value="HTML Basics">HTML Basics</option>
              <option value="HTML Structure">HTML Structure</option>
              <option value="HTML Forms">HTML Forms</option>
            </optgroup>
            <optgroup label="CSS">
              <option value="CSS Fundamentals">CSS Fundamentals</option>
              <option value="CSS Layout">CSS Layout</option>
              <option value="CSS Animations">CSS Animations</option>
            </optgroup>
            <optgroup label="JavaScript">
              <option value="JS Fundamentals">JS Fundamentals</option>
              <option value="JS DOM">JS DOM</option>
              <option value="JS Async">JS Async</option>
            </optgroup>
            <optgroup label="Advanced">
              <option value="TypeScript">TypeScript</option>
              <option value="Python">Python</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Level / Order</label>
          <input
            type="number"
            min={1}
            max={999}
            value={puzzleData.trackOrder != null ? Number(puzzleData.trackOrder) : ''}
            onChange={(e) => onDataChange('trackOrder', e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 1"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
        </div>
      </div>

      {/* ── Concept Tags ───────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Concept Tags <span className="font-normal text-gray-500">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={Array.isArray(puzzleData.concepts) ? (puzzleData.concepts as string[]).join(', ') : asString(puzzleData.concepts, '')}
          onChange={(e) => onDataChange('concepts', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          placeholder="e.g. HTML, semantic elements, nav"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>

      {/* ── Scenario ───────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Scenario</label>
        <textarea
          value={asString(puzzleData.scenario, '')}
          onChange={(e) => onDataChange('scenario', e.target.value)}
          placeholder="Describe the mission and what's broken"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>

      {/* ── Theory (Learn Before You Code) ─────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">
          📖 Learn Before You Code <span className="font-normal text-gray-500">(theory shown above editor)</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Explain the concept the puzzle is teaching. Shown as a collapsible panel before users start coding — open by default.
        </p>
        <textarea
          value={asString(puzzleData.theory, '')}
          onChange={(e) => onDataChange('theory', e.target.value)}
          placeholder={`e.g. The <nav> element is a semantic HTML5 landmark used to group major navigation links.\n\nUsing <nav> instead of <div> tells browsers and screen readers that this block contains navigation. It improves accessibility and helps search engines understand your page structure.\n\nExample:\n<nav>\n  <a href="/home">Home</a>\n  <a href="/about">About</a>\n</nav>`}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-40 font-mono text-xs"
        />
      </div>

      {/* ── Lesson Summary (post-solve reveal) ────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">
          🎉 Lesson Summary <span className="font-normal text-gray-500">(shown in celebration after solve)</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Explain what users just learned and WHY the fix works. Revealed only after a correct submission.
        </p>
        <textarea
          value={asString(puzzleData.lessonSummary, '')}
          onChange={(e) => onDataChange('lessonSummary', e.target.value)}
          placeholder={`e.g. You just replaced a generic <div> with a semantic <nav> element.\n\nWhy it matters:\n• Screen readers announce "navigation" to users — helping accessibility.\n• Search engines use <nav> to understand your page layout.\n• Your HTML is now self-documenting — any developer reading it immediately knows this is a nav block.\n\nKey rule: Use semantic elements whenever the content has a clear meaning.`}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-40 font-mono text-xs"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Language</label>
          <select
            value={asString(puzzleData.language, 'html')}
            onChange={(e) => onDataChange('language', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          >
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Validation Mode</label>
          <select
            value={asString(puzzleData.validationMode, 'exact')}
            onChange={(e) => onDataChange('validationMode', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
          >
            <option value="exact">Exact Match</option>
            <option value="contains">Must Contain</option>
            <option value="regex">Regex</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Broken Code</label>
        <textarea
          value={asString(puzzleData.brokenCode, '')}
          onChange={(e) => onDataChange('brokenCode', e.target.value)}
          placeholder="Paste the broken code"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-32 font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Prefill CSS <span className="font-normal text-gray-500">(optional — for HTML puzzles)</span></label>
        <textarea
          value={asString(puzzleData.prefillCss, '')}
          onChange={(e) => onDataChange('prefillCss', e.target.value)}
          placeholder="Optional CSS to prefill styles.css"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24 font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">
          Multi-file Override <span className="font-normal text-gray-500">(JSON — overrides Broken Code above)</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Provide a JSON object mapping file paths to code. When set, this replaces the Broken Code field.
          Example: <code className="text-indigo-300">&#123; "/index.html": "...", "/styles.css": "..." &#125;</code>
        </p>
        <textarea
          value={puzzleData.files ? JSON.stringify(puzzleData.files, null, 2) : ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) { onDataChange('files', null); return; }
            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed === 'object' && parsed !== null) onDataChange('files', parsed);
            } catch { /* let them keep typing */ }
          }}
          placeholder={`{\n  "/index.html": "<!doctype html>...",\n  "/styles.css": "body { ... }"\n}`}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-28 font-mono text-xs"
          spellCheck={false}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Expected Fix</label>
        <textarea
          value={asString(puzzleData.expectedFix, '')}
          onChange={(e) => onDataChange('expectedFix', e.target.value)}
          placeholder="What should the fixed code look like?"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-32 font-mono"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Must Contain (comma or newline)</label>
          <textarea
            value={asStringArray((puzzleData.validationRules as Record<string, unknown> | undefined)?.mustContain).join('\n')}
            onChange={(e) => updateValidationRule('mustContain', asStringArray(e.target.value))}
            placeholder="e.g., <nav>"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Must Not Contain (comma or newline)</label>
          <textarea
            value={asStringArray((puzzleData.validationRules as Record<string, unknown> | undefined)?.mustNotContain).join('\n')}
            onChange={(e) => updateValidationRule('mustNotContain', asStringArray(e.target.value))}
            placeholder="e.g., <center>"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Regex (optional)</label>
        <input
          type="text"
          value={asString((puzzleData.validationRules as Record<string, unknown> | undefined)?.regex, '')}
          onChange={(e) => updateValidationRule('regex', e.target.value)}
          placeholder="e.g., <nav>.*</nav>"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={Boolean((puzzleData.validationRules as Record<string, unknown> | undefined)?.ignoreCase)}
            onChange={(e) => updateValidationRule('ignoreCase', e.target.checked)}
            className="h-4 w-4"
          />
          Ignore Case
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={Boolean((puzzleData.validationRules as Record<string, unknown> | undefined)?.ignoreWhitespace)}
            onChange={(e) => updateValidationRule('ignoreWhitespace', e.target.checked)}
            className="h-4 w-4"
          />
          Ignore Whitespace
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={(puzzleData.validationRules as Record<string, unknown> | undefined)?.colorFlex !== false}
            onChange={(e) => updateValidationRule('colorFlex', e.target.checked)}
            className="h-4 w-4"
          />
          Match Color Names (e.g., blue)
        </label>
      </div>
    </div>
  );

  // ── Crime RPG initializer ────────────────────────────────────────────────
  useEffect(() => {
    if (puzzleType !== 'crime_rpg') return;
    const existing = (puzzleData as any)?.crimeCase;
    const template = {
      caseTitle: 'The Cartographer\'s Last Map',
      premise: 'A renowned cartographer is found dead in his locked study. Three colleagues had keys. The map he was working on — rumoured to expose a buried secret — is missing. You have 48 hours before the estate is sold and the evidence destroyed.',
      caseClockHours: 48,
      sceneImageUrl: '',
      evidence: [
        {
          id: 'e1',
          label: 'Torn Letter',
          type: 'document',
          summary: 'Half a letter found in the grate. Ink still legible.',
          content: 'Victor —\n\nIf this reaches you I am already beyond helping. The map is not what they think. Look beneath the —\n\n[TORN]',
          imageUrl: '',
          hiddenLayers: [
            {
              id: 'e1_layer1',
              trigger: 'contrast',
              filterThreshold: 2.2,
              revealText: 'A faint second handwriting appears in the margin: "Do not let R. see this. He already suspects."',
            },
          ],
        },
        {
          id: 'e2',
          label: 'Access Log',
          type: 'record',
          summary: 'Electronic log for the study\'s smart lock. Last 24 hours.',
          content: '2024-03-14  08:12  UNLOCK  —  card #4 (Renata H.)\n2024-03-14  08:55  LOCK    —  auto-close\n2024-03-14  13:40  UNLOCK  —  card #4 (Renata H.)\n2024-03-14  14:02  LOCK    —  manual\n2024-03-14  21:17  UNLOCK  —  card #1 (Victor M. — MASTER)\n2024-03-14  21:19  LOCK    —  auto-close\n2024-03-15  02:41  UNLOCK  —  card #4 (Renata H.)\n2024-03-15  02:44  LOCK    —  manual\n2024-03-15  07:03  UNLOCK  —  card #2 (Dmitri L.)\n2024-03-15  07:03  ALARM   —  body found',
          imageUrl: '',
        },
        {
          id: 'e3',
          label: 'Chat Log: Renata & Victor',
          type: 'chat_log',
          summary: 'Encrypted message thread recovered from Victor\'s phone.',
          content: 'Renata: I saw what you found in the annexe. You should have told me.\nVictor: It was never yours to know.\nRenata: You can\'t publish those coordinates without the consortium\'s approval.\nVictor: Watch me.\n[14 hours gap]\nRenata: We can still work this out. Meet me tonight.\nVictor: Come after 9. I\'ll leave the lock off.',
          imageUrl: '',
          hiddenLayers: [
            {
              id: 'e3_layer1',
              trigger: 'combine',
              combineWithId: 'e2',
              revealText: 'Cross-referencing the chat with the access log: Renata arrived at 02:41 — five hours after Victor said he\'d leave the lock off. That gap is unaccounted for.',
            },
          ],
        },
        {
          id: 'e4',
          label: 'Autopsy Summary',
          type: 'record',
          summary: 'Pathologist\'s preliminary findings.',
          content: 'Victim: Victor Malone, 61\nTime of death: 22:00–23:30 (±45 min)\nCause: Cardiac arrest\nNote: Traces of digoxin found in blood — 3× therapeutic threshold.\nNote: Victim had a documented heart condition; prescription on file.\nNote: A digoxin overdose in a patient with existing cardiac issues can be undetectable without a full toxicology screen.',
          imageUrl: '',
        },
        {
          id: 'e5',
          label: 'Renata\'s Bag Contents',
          type: 'photo',
          summary: 'Inventory photo taken when suspect was detained.',
          content: 'Items photographed:\n- Wallet\n- Car keys (rental, same model as tyre tracks outside)\n- Prescription bottle (label scratched off, pills match digoxin)\n- A torn corner of paper matching the grain of the Torn Letter\n- Map tube (empty)',
          imageUrl: '',
          hiddenLayers: [
            {
              id: 'e5_layer1',
              trigger: 'zoom',
              revealText: 'Zooming in on the prescription bottle: the batch number is still readable — FL-2291. The dispensing pharmacy\'s records will show when and by whom this was collected.',
            },
          ],
        },
      ],
      suspects: [
        {
          id: 'renata',
          name: 'Renata Holst',
          age: 44,
          role: 'Consortium Director',
          photoUrl: '',
          bio: 'Holds access card #4. Was in the building twice during the night. Stands to lose funding rights if Victor publishes independently. No alibi for the 22:00 window.',
          interrogation: [
            {
              id: 'renata_q1',
              question: 'Where were you between 21:00 and 23:00 on the night of the incident?',
              answer: 'I was at my apartment. I had no reason to be there that late.',
              isFlaggedAnswer: false,
            },
            {
              id: 'renata_q2',
              question: 'Access logs show you entered the study at 02:41. What were you looking for?',
              answer: 'I... I forgot some papers. That\'s all. I didn\'t see anything unusual.',
              isFlaggedAnswer: true,
            },
            {
              id: 'renata_q3',
              question: 'Are you familiar with digoxin?',
              answer: 'Only in passing. I know it\'s a heart medication. Victor mentioned it once.',
              isFlaggedAnswer: true,
            },
          ],
        },
        {
          id: 'dmitri',
          name: 'Dmitri Lenz',
          age: 38,
          role: 'Research Assistant',
          photoUrl: '',
          bio: 'Holds access card #2. Found the body at 07:03. Claims he arrived early to collect equipment. Seemed calm during questioning.',
          interrogation: [
            {
              id: 'dmitri_q1',
              question: 'Why did you arrive so early that morning?',
              answer: 'I always come in early to run calibrations. It\'s part of my routine.',
              isFlaggedAnswer: false,
            },
            {
              id: 'dmitri_q2',
              question: 'Did you notice anything unusual when you arrived?',
              answer: 'The study door was ajar. I thought that was odd. Victor always locks it.',
              isFlaggedAnswer: false,
            },
          ],
        },
        {
          id: 'elena',
          name: 'Elena Voss',
          age: 55,
          role: 'Estate Lawyer',
          photoUrl: '',
          bio: 'Does not have a building key but was seen in the car park at 21:45. Primary beneficiary of Victor\'s will. No known motive related to the map.',
          interrogation: [
            {
              id: 'elena_q1',
              question: 'Why were you in the car park at 21:45?',
              answer: 'Victor called me about an urgent amendment to his will. I waited but he never came down.',
              isFlaggedAnswer: true,
            },
            {
              id: 'elena_q2',
              question: 'Did you enter the building that night?',
              answer: 'No. I don\'t have access. I waited outside for twenty minutes then left.',
              isFlaggedAnswer: false,
            },
          ],
        },
      ],
      mechanisms: [
        'Digoxin overdose administered in Victor\'s evening drink',
        'Blunt force trauma staged as a fall',
        'Suffocation using a pillow (no marks at autopsy)',
        'Induced cardiac arrest via electric shock',
      ],
      timeline: [
        { id: 't1', time: '08:12', description: 'Renata enters the study — first visit.', correctPosition: 1 },
        { id: 't2', time: '13:40', description: 'Renata enters again, stays 22 minutes.', correctPosition: 2 },
        { id: 't3', time: '21:17', description: 'Victor unlocks his own study.', correctPosition: 3 },
        { id: 't4', time: '~22:15', description: 'Victor dies (estimated from autopsy).', correctPosition: 4 },
        { id: 't5', time: '02:41', description: 'Renata enters the study alone in the night.', correctPosition: 5 },
        { id: 't6', time: '07:03', description: 'Dmitri finds the body.', correctPosition: 6 },
      ],
      solution: {
        principalSuspectId: 'renata',
        mechanism: 'Digoxin overdose administered in Victor\'s evening drink',
        requiredEvidenceIds: ['e2', 'e3', 'e4', 'e5'],
      },
      retentionUnlock: 'SEALED EVIDENCE — CASE #VX-2291\n\nThe map was recovered from a safety deposit box held under a shell company registered to Renata Holst. The coordinates it contained pointed to an unclaimed mineral survey in disputed territory — worth an estimated $800M in extraction rights.\n\nThe map is now in the custody of the International Geographic Institute.\n\nRenata Holst was charged with first-degree murder and conspiracy to defraud. Trial date: pending.',
    };
    try {
      const next = existing && typeof existing === 'object' ? existing : template;
      setCrimeCaseJson(JSON.stringify(next, null, 2));
      setCrimeCaseJsonError('');
      onDataChange('crimeCase', next);
    } catch {
      setCrimeCaseJson(JSON.stringify(template, null, 2));
      setCrimeCaseJsonError('');
      onDataChange('crimeCase', template);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleType]);

  const renderCrimeCaseFields = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-300">
        Configure the <span className="font-semibold">Crime RPG</span> case by editing the JSON below.
        The template includes a fully playable sample case — replace it with your own.
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div><span className="text-yellow-400 font-semibold">evidence[].type</span> — one of: <code>document</code>, <code>photo</code>, <code>chat_log</code>, <code>record</code>, <code>audio_log</code></div>
        <div><span className="text-yellow-400 font-semibold">evidence[].imageUrl</span> — optional URL; for <code>photo</code> type this is the primary image; for all other types it renders as an &quot;Attached Photo&quot; beneath the content</div>
        <div><span className="text-yellow-400 font-semibold">suspects[].photoUrl</span> — optional URL for a suspect portrait; renders as a full-width banner with gradient overlay on the card</div>
        <div><span className="text-yellow-400 font-semibold">suspects[].interrogation</span> — optional array of Q&amp;A objects (<code>id</code>, <code>question</code>, <code>answer</code>, <code>isFlaggedAnswer?</code>); reveals a 🎙 Interrogate button per suspect; answers with <code>isFlaggedAnswer:true</code> surface a 🚩 badge on the suspect card</div>
        <div><span className="text-yellow-400 font-semibold">sceneImageUrl</span> — optional URL for a crime scene overview image; enables the &quot;Scene&quot; tab with click-to-zoom</div>
        <div><span className="text-yellow-400 font-semibold">hiddenLayers[].trigger</span> — one of: <code>contrast</code> (slider), <code>zoom</code> (button), <code>combine</code> (link two evidence items)</div>
        <div><span className="text-yellow-400 font-semibold">solution.requiredEvidenceIds</span> — the IDs the player must select as their evidence chain</div>
      </div>
      <textarea
        value={crimeCaseJson}
        onChange={(e) => {
          const next = e.target.value;
          setCrimeCaseJson(next);
          try {
            const parsed = JSON.parse(next);
            onDataChange('crimeCase', parsed);
            setCrimeCaseJsonError('');
          } catch {
            setCrimeCaseJsonError('Invalid JSON — fix before saving.');
          }
        }}
        className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white font-mono text-xs h-96"
        spellCheck={false}
      />
      {crimeCaseJsonError ? <div className="text-sm text-red-300">{crimeCaseJsonError}</div> : null}
    </div>
  );

  // ── Parasite Code initializer ─────────────────────────────────────────────
  useEffect(() => {
    if (puzzleType !== 'parasite_code') return;
    const existing = (puzzleData as any)?.parasiteCode;
    const template = {
      caseTitle: 'The Refund Siphon',
      programName: 'refund_router_v2.prg',
      contextNarrative: 'Customer success reported that a handful of VIP refunds are settling a little short, but only on larger payouts. The service logs look normal, and the code review history shows no recent feature work in the refund path. You have the runtime cases and the source snapshot. Find the lines that siphon money out of the payout calculation.',
      strainFamily: 'input-triggered-sleeper',
      activationCondition: 'Triggers when TIER equals "VIP" AND AMOUNT exceeds 500',
      parasiteLineIds: ['L10', 'L11'],
      program: [
        { id: 'L01', lineNumber: 1,  opcode: 'LOAD', operands: ['R0', 'TIER'],        comment: 'load customer tier' },
        { id: 'L02', lineNumber: 2,  opcode: 'LOAD', operands: ['R1', 'AMOUNT'],      comment: 'load requested refund amount' },
        { id: 'L03', lineNumber: 3,  opcode: 'SET',  operands: ['R2', '0.02'],        comment: 'standard processing fee rate' },
        { id: 'L04', lineNumber: 4,  opcode: 'MUL',  operands: ['R3', 'R1', 'R2'],    comment: 'R3 = standard fee' },
        { id: 'L05', lineNumber: 5,  opcode: 'SET',  operands: ['R4', 'VIP'],         comment: '' },
        { id: 'L06', lineNumber: 6,  opcode: 'CMP',  operands: ['R0', 'R4'],          comment: 'FLAG = tier is VIP' },
        { id: 'L07', lineNumber: 7,  opcode: 'IF',   operands: ['FLAG', '==', '1'],   comment: 'VIP refunds waive the fee' },
        { id: 'L08', lineNumber: 8,  opcode: 'SET',  operands: ['R3', '0'],           comment: '' },
        { id: 'L09', lineNumber: 9,  opcode: 'IF',   operands: ['R1', '>', '500'],    comment: 'high-value branch' },
        { id: 'L10', lineNumber: 10, opcode: 'SET',  operands: ['R5', '12.5'],        comment: '', isParasite: true },
        { id: 'L11', lineNumber: 11, opcode: 'ADD',  operands: ['R3', 'R3', 'R5'],    comment: '', isParasite: true },
        { id: 'L12', lineNumber: 12, opcode: 'SUB',  operands: ['R6', 'R1', 'R3'],    comment: 'R6 = payout after fee adjustments' },
        { id: 'L13', lineNumber: 13, opcode: 'OUT',  operands: ['R6'],                comment: 'emit refund payout' },
        { id: 'L14', lineNumber: 14, opcode: 'HALT', operands: [],                    comment: '' },
      ],
      testInputs: [
        {
          id: 'T1',
          label: 'Standard customer refund — Tier: STANDARD, Amount: 250',
          values: { TIER: 'STANDARD', AMOUNT: 250 },
          expectedOutput: '245',
          activatesParasite: false,
        },
        {
          id: 'T2',
          label: 'VIP goodwill refund — Tier: VIP, Amount: 120',
          values: { TIER: 'VIP', AMOUNT: 120 },
          expectedOutput: '120',
          activatesParasite: false,
        },
        {
          id: 'T3',
          label: 'VIP escalation refund — Tier: VIP, Amount: 900',
          values: { TIER: 'VIP', AMOUNT: 900 },
          expectedOutput: '900',
          activatesParasite: true,
        },
      ],
      retentionUnlock: 'INCIDENT NOTES — CASE RF-118\n\nThe extra fee was routed into a dormant ledger bucket that reconciled to a third-party settlement account every Friday night. The ledger name matched an abandoned migration artifact, which is why dashboards treated it as harmless noise.\n\nAccess keys rotated. Finance and platform security notified.',
    };
    try {
      const next = existing && typeof existing === 'object' ? existing : template;
      setParasiteCodeJson(JSON.stringify(next, null, 2));
      setParasiteCodeJsonError('');
      onDataChange('parasiteCode', next);
    } catch {
      setParasiteCodeJson(JSON.stringify(template, null, 2));
      setParasiteCodeJsonError('');
      onDataChange('parasiteCode', template);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleType]);

  const renderParasiteCodeFields = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-300">
        Configure the <span className="font-semibold">Parasite Code</span> case by editing the JSON below.
        The template includes a fully playable sample — replace it with your own.
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div><span className="text-yellow-400 font-semibold">program[].id</span> — e.g. &quot;L01&quot; — IDs the player submits as their quarantine list</div>
        <div><span className="text-yellow-400 font-semibold">program[].opcode</span> — one of: <code>SET ADD SUB MUL CMP IF GOTO CALL RET LOAD OUT HALT</code></div>
        <div><span className="text-yellow-400 font-semibold">program[].isParasite</span> — <code>true</code> on parasite lines; stripped before sending to client</div>
        <div><span className="text-yellow-400 font-semibold">parasiteLineIds</span> — array of IDs that form the correct quarantine answer</div>
        <div><span className="text-yellow-400 font-semibold">strainFamily</span> — one of: <code>timing-parasite input-triggered-sleeper obfuscated-redirect logic-bomb data-exfil privilege-escalation output-manipulator persistence-hook covert-channel</code></div>
        <div><span className="text-yellow-400 font-semibold">testInputs[].activatesParasite</span> — marks the server-side trigger case; hidden from the player so they must infer it from output and trace evidence</div>
        <div><span className="text-yellow-400 font-semibold">activationCondition</span> — revealed to the player <em>only after</em> they solve the puzzle</div>
        <div><span className="text-yellow-400 font-semibold">retentionUnlock</span> — optional declassified lore text shown after solve</div>
      </div>
      <textarea
        value={parasiteCodeJson}
        onChange={(e) => {
          const next = e.target.value;
          setParasiteCodeJson(next);
          try {
            const parsed = JSON.parse(next);
            onDataChange('parasiteCode', parsed);
            setParasiteCodeJsonError('');
          } catch {
            setParasiteCodeJsonError('Invalid JSON — fix before saving.');
          }
        }}
        className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white font-mono text-xs h-96"
        spellCheck={false}
      />
      {parasiteCodeJsonError ? <div className="text-sm text-red-300">{parasiteCodeJsonError}</div> : null}
    </div>
  );

  // ── Gridlock File initializer ─────────────────────────────────────────────
  useEffect(() => {
    if (puzzleType !== 'gridlock_file') return;
    const existing = getGridlockFileData((puzzleData as any)?.gridlockFile ?? puzzleData);
    const template = createDefaultGridlockFileData();
    try {
      const next = existing ?? template;
      setGridlockFileJson(JSON.stringify(next, null, 2));
      setGridlockFileJsonError('');
      onDataChange('gridlockFile', next);
    } catch {
      setGridlockFileJson(JSON.stringify(template, null, 2));
      setGridlockFileJsonError('');
      onDataChange('gridlockFile', template);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleType]);

  const renderGridlockFileFields = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-300">
        Configure the <span className="font-semibold">Gridlock File</span> puzzle by editing the JSON below.
        The template shows a fully playable Day 1 puzzle — replace it with your own.
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div><span className="text-yellow-400 font-semibold">grid</span> — 2D array of <code>{'{'}value, isMissing?{'}'}</code>. Set <code>isMissing: true</code> on cells the player must solve.</div>
        <div><span className="text-yellow-400 font-semibold">correctAnswers</span> — ordered array matching each <code>isMissing</code> cell left-to-right, top-to-bottom.</div>
        <div><span className="text-yellow-400 font-semibold">primaryRuleFamily</span> — one of: <code>arithmetic geometric fibonacci polynomial alphabetic compound-word constraint positional semantic hybrid</code></div>
        <div><span className="text-yellow-400 font-semibold">primaryRuleAxis</span> — one of: <code>rows columns both diagonal spiral cell-position</code></div>
        <div><span className="text-yellow-400 font-semibold">ruleExplanation</span> — shown ONLY after the player solves correctly.</div>
        <div><span className="text-yellow-400 font-semibold">retentionUnlock</span> — optional lore text revealed after solve.</div>
        <div><span className="text-yellow-400 font-semibold">hints[].cost</span> — XP cost deducted when hint is revealed (default 1).</div>
      </div>
      <textarea
        value={gridlockFileJson}
        onChange={(e) => {
          const next = e.target.value;
          setGridlockFileJson(next);
          try {
            const parsed = getGridlockFileData(JSON.parse(next));
            if (!parsed) {
              setGridlockFileJsonError('Gridlock JSON must include grid, correctAnswers, ruleExplanation, and primary rule metadata.');
              return;
            }
            onDataChange('gridlockFile', parsed);
            setGridlockFileJsonError('');
          } catch {
            setGridlockFileJsonError('Invalid JSON — fix before saving.');
          }
        }}
        className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white font-mono text-xs h-96"
        spellCheck={false}
      />
      {gridlockFileJsonError ? <div className="text-sm text-red-300">{gridlockFileJsonError}</div> : null}
    </div>
  );

  useEffect(() => {
    if (puzzleType !== 'vault') return;
    const existing = getVaultPuzzleData((puzzleData as any)?.vault ?? puzzleData);
    const template = createDefaultVaultData();
    const initial = existing ?? template;
    setVaultJson(JSON.stringify(initial, null, 2));
    setVaultJsonError('');
    onDataChange('vault', initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleType]);

  // ── Cipher Clash ───────────────────────────────────────────────────────────
  const [cipherPhrasesText, setCipherPhrasesText] = useState<string>(() => {
    const init: string[] = Array.isArray(puzzleData.phrases) ? (puzzleData.phrases as string[]) : [];
    return init.join('\n');
  });

  useEffect(() => {
    if (puzzleType !== 'cipher_clash') return;
    const stored: string[] = Array.isArray(puzzleData.phrases) ? (puzzleData.phrases as string[]) : [];
    const joined = stored.join('\n');
    if (joined !== cipherPhrasesText.split('\n').map(l => l.trim()).filter(Boolean).join('\n')) {
      setCipherPhrasesText(joined);
    }
  }, [puzzleType]);

  const renderCipherClashFields = () => {
    const parsedPhrases = cipherPhrasesText.split('\n').map(l => l.trim()).filter(Boolean);
    const roundTimeSec = Number(puzzleData.roundTimeSec ?? 180);
    const revealedLetters = Number(puzzleData.revealedLetters ?? 3);
    const comboMultiplier = Number(puzzleData.comboMultiplier ?? 1.5);

    const uniqueLetters = new Set<string>();
    parsedPhrases.forEach(p => p.toUpperCase().split('').forEach(ch => { if (/[A-Z]/.test(ch)) uniqueLetters.add(ch); }));

    const commitPhrases = (text: string) => {
      const phrases = text.split('\n').map(l => l.trim()).filter(Boolean);
      onDataChange('phrases', phrases);
    };

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Phrases to Encode <span className="text-red-400">*</span></label>
          <textarea
            value={cipherPhrasesText}
            rows={8}
            onChange={(e) => setCipherPhrasesText(e.target.value)}
            onBlur={(e) => commitPhrases(e.target.value)}
            placeholder={"THE QUICK BROWN FOX\nJUMPS OVER THE LAZY DOG\nCRACK THE CODE\nPUZZLE WARZ RULES\nSECRET MESSAGE UNLOCKED"}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 font-mono uppercase"
          />
          <p className="text-xs text-gray-500 mt-1">One phrase per line. The system auto-generates a random substitution cipher for each game session. Players decode phrases to claim letter mappings. Min 3 phrases recommended.</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Round Timer (seconds)</label>
            <input
              type="number"
              min={30}
              max={600}
              value={roundTimeSec}
              onChange={(e) => onDataChange('roundTimeSec', Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">How long players have to decode all phrases.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Pre-Revealed Letters</label>
            <input
              type="number"
              min={0}
              max={10}
              value={revealedLetters}
              onChange={(e) => onDataChange('revealedLetters', Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Letter mappings given free at start. More = easier.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Combo Multiplier</label>
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              value={comboMultiplier}
              onChange={(e) => onDataChange('comboMultiplier', Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Bonus multiplier for consecutive correct solves.</p>
          </div>
        </div>

        {parsedPhrases.length > 0 && (
          <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(56,145,166,0.1)', border: '1px solid rgba(56,145,166,0.3)', color: '#7dd3fc' }}>
            <strong>{parsedPhrases.length}</strong> phrase{parsedPhrases.length !== 1 ? 's' : ''} ·{' '}
            <strong>{uniqueLetters.size}</strong> unique letters ·{' '}
            <strong>{roundTimeSec}s</strong> timer ·{' '}
            <strong>{revealedLetters}</strong> pre-revealed ·{' '}
            <strong>{comboMultiplier}x</strong> combo
          </div>
        )}

        <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(253,231,76,0.06)', border: '1px solid rgba(253,231,76,0.2)', color: '#fcd34d' }}>
          <strong>How it works:</strong> A random substitution cipher is generated each session. Players see the encoded text and must figure out the original phrases. Each solved phrase &quot;claims&quot; its letter mappings, which auto-reveal in future phrases. Consecutive correct solves build a combo multiplier. In Warz mode, claimed mappings are denied to the opponent.
        </div>
      </div>
    );
  };

  const renderVaultFields = () => {
    const parsed = getVaultPuzzleData((puzzleData as any)?.vault ?? puzzleData);
    const derived = parsed ? getVaultDerivedLetters(parsed) : [];

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-300">
          Configure <span className="font-semibold">The Vault</span> as a three-stage logic puzzle. The default template includes a full grid pattern, letter clue chain, and final extraction code.
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <div><span className="text-yellow-400 font-semibold">grid</span> — a 3x3 array of three-digit numbers.</div>
          <div><span className="text-yellow-400 font-semibold">missing</span> — the hidden row and column players must solve in Stage 1.</div>
          <div><span className="text-yellow-400 font-semibold">clueLines</span> — ordered row/column totals converted to letters for Stage 2.</div>
          <div><span className="text-yellow-400 font-semibold">targetWord</span> — the instruction word players must unscramble.</div>
          <div><span className="text-yellow-400 font-semibold">extraction</span> — ordered cell positions used to build the final code. Each step can use either <code>cell</code> for a named corner or explicit <code>row</code>/<code>col</code> coordinates.</div>
          <div><span className="text-yellow-400 font-semibold">finalCode</span> — optional override; if blank, the app computes it from the extraction steps.</div>
        </div>
        <textarea
          value={vaultJson}
          onChange={(e) => {
            const next = e.target.value;
            setVaultJson(next);
            try {
              const parsedJson = getVaultPuzzleData(JSON.parse(next));
              if (!parsedJson) {
                setVaultJsonError('Vault JSON must include a valid 3x3 grid and extraction settings.');
                return;
              }
              onDataChange('vault', parsedJson);
              setVaultJsonError('');
            } catch {
              setVaultJsonError('Invalid JSON — fix before saving.');
            }
          }}
          className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white font-mono text-xs h-96"
          spellCheck={false}
        />
        {vaultJsonError ? <div className="text-sm text-red-300">{vaultJsonError}</div> : null}
        {parsed ? (
          <div className="rounded-lg border border-slate-600 bg-slate-900/40 p-4 space-y-2 text-sm text-slate-200">
            <div className="font-semibold text-white">Preview</div>
            <div>Hidden center: <span className="font-mono text-amber-300">{parsed.grid[parsed.missing.row][parsed.missing.col]}</span></div>
            <div>Stage 2 letters: <span className="font-mono text-amber-300">{derived.map((entry) => entry.letter).join(' ')}</span> -&gt; {parsed.targetWord}</div>
            <div>Final code: <span className="font-mono text-emerald-300">{parsed.finalCode}</span></div>
          </div>
        ) : null}
      </div>
    );
  };

  // ── The Debrief initializer ───────────────────────────────────────────────
  const DEBRIEF_TEMPLATE = {
    scenario: {
      id: "debrief-001",
      caseNumber: "001",
      classification: "RESTRICTED",
      dateTime: "January 1, 2026 — 00:00",
      report: "Write the classified intelligence report here. The player has 35 seconds to read and memorize it.",
      questions: [
        { question: "Question 1?", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 0 },
        { question: "Question 2?", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 1 },
        { question: "Question 3?", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 2 },
        { question: "Question 4?", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 3 },
        { question: "Question 5?", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 0 },
      ],
    },
  };

  useEffect(() => {
    if (puzzleType !== 'debrief') return;
    const existing = (puzzleData as any)?.debrief ?? null;
    const initial = existing ?? DEBRIEF_TEMPLATE;
    setDebriefJson(JSON.stringify(initial, null, 2));
    setDebriefJsonError('');
    onDataChange('debrief', initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleType]);

  const renderDebriefFields = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-300">
        Configure <span className="font-semibold">The Debrief</span> daily puzzle. The player reads a classified report for 35 seconds, then answers 5 recall questions (18s each).
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div><span className="text-yellow-400 font-semibold">scenario.id</span> — unique string ID for this scenario (e.g. <code>"debrief-001"</code>)</div>
        <div><span className="text-yellow-400 font-semibold">scenario.questions</span> — array of at least 5 questions; each has <code>question</code>, <code>options[4]</code>, <code>correctIndex</code></div>
      </div>
      <textarea
        value={debriefJson}
        onChange={(e) => {
          const next = e.target.value;
          setDebriefJson(next);
          try {
            const parsed = JSON.parse(next);
            if (!parsed?.scenario?.id || !Array.isArray(parsed?.scenario?.questions) || parsed.scenario.questions.length < 5) {
              setDebriefJsonError('JSON must include scenario.id and at least 5 scenario.questions entries.');
              return;
            }
            onDataChange('debrief', parsed);
            setDebriefJsonError('');
          } catch {
            setDebriefJsonError('Invalid JSON — fix before saving.');
          }
        }}
        className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white font-mono text-xs h-[32rem]"
        spellCheck={false}
      />
      {debriefJsonError ? <div className="text-sm text-red-300">{debriefJsonError}</div> : null}
    </div>
  );

  const renderDetectiveCaseFields = () => {
    /** Rebuild full detectiveCase object from individual fields + stages JSON, then push to parent */
    function syncDetectiveCase(overrides: {
      noirTitle?: string; intro?: string;
      prologueText?: string; narratorName?: string; narratorVoice?: string;
      bgImage?: string; bgVideo?: string; audio?: string; audioLoop?: boolean;
      stagesJson?: string;
    } = {}) {
      const title      = overrides.noirTitle     ?? dcNoirTitle;
      const intro      = overrides.intro         ?? dcIntro;
      const pText      = overrides.prologueText  ?? dcPrologueText;
      const nName      = overrides.narratorName  ?? dcNarratorName;
      const nVoice     = overrides.narratorVoice ?? dcNarratorVoice;
      const bgImg      = overrides.bgImage       ?? dcPrologueBgImage;
      const bgVid      = overrides.bgVideo       ?? dcPrologueBgVideo;
      const aud        = overrides.audio         ?? dcPrologueAudio;
      const audLoop    = overrides.audioLoop     !== undefined ? overrides.audioLoop : dcPrologueAudioLoop;
      const stJson     = overrides.stagesJson    ?? detectiveJson;

      let stages: unknown[] = [];
      try { stages = JSON.parse(stJson); } catch { /* leave empty */ }

      const obj: Record<string, unknown> = {
        noirTitle: title,
        intro,
        lockMode: 'fail_once',
        stages,
      };
      if (pText.trim()) {
        obj.prologue = {
          text: pText,
          ...(nName.trim()  ? { narratorName: nName }  : {}),
          ...(nVoice.trim() ? { narratorVoice: nVoice } : {}),
          ...(bgImg.trim()  ? { backgroundImage: bgImg } : {}),
          ...(bgVid.trim()  ? { backgroundVideo: bgVid } : {}),
          ...(aud.trim()    ? { audio: aud, audioLoop: audLoop } : {}),
        };
      }
      onDataChange('detectiveCase', obj);
    }

    return (
      <div className="space-y-6">
        {/* Series header */}
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black tracking-[0.2em] uppercase"
            style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308' }}
          >
            ◆ WISE UP ◆
          </div>
          <span className="text-xs text-zinc-500">Multi-stage · one wrong answer locks the case forever</span>
        </div>

        {/* Case Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Case Title</label>
          <input
            type="text"
            value={dcNoirTitle}
            onChange={e => { setDcNoirTitle(e.target.value); syncDetectiveCase({ noirTitle: e.target.value }); }}
            placeholder="e.g. The Blackout Ledger"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
        </div>

        {/* Case Brief */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Case Brief <span className="font-normal text-zinc-500">(short tagline shown before stages)</span></label>
          <textarea
            value={dcIntro}
            onChange={e => { setDcIntro(e.target.value); syncDetectiveCase({ intro: e.target.value }); }}
            placeholder="A sentence or two setting the scene…"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-16 resize-none"
          />
        </div>

        {/* Prologue section */}
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xs font-black tracking-widest uppercase">Opening Prologue</span>
            <span className="text-xs text-zinc-500">— shown as a cinematic screen before Stage 1</span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Detective's Monologue</label>
            <textarea
              value={dcPrologueText}
              onChange={e => { setDcPrologueText(e.target.value); syncDetectiveCase({ prologueText: e.target.value }); }}
              placeholder="How did the case land in their lap? Write it in the detective's voice. Use line breaks for paragraphs."
              className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white placeholder-gray-500 h-40 font-serif text-sm"
              spellCheck={false}
            />
            <div className="text-xs text-zinc-500 mt-1">Leave blank to skip the prologue screen entirely.</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Narrator Name <span className="font-normal text-zinc-500">(optional)</span></label>
              <input
                type="text"
                value={dcNarratorName}
                onChange={e => { setDcNarratorName(e.target.value); syncDetectiveCase({ narratorName: e.target.value }); }}
                placeholder="e.g. Det. Ray Voss"
                className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Voice Style <span className="font-normal text-zinc-500">(optional · drives future TTS)</span></label>
              <input
                type="text"
                value={dcNarratorVoice}
                onChange={e => { setDcNarratorVoice(e.target.value); syncDetectiveCase({ narratorVoice: e.target.value }); }}
                placeholder="e.g. gravel, weary, sharp, dry wit"
                className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white placeholder-gray-500"
              />
            </div>
          </div>

          {/* Media */}
          <div className="border-t border-yellow-500/10 pt-4 space-y-3">
            <div className="text-xs font-semibold text-yellow-400/70 tracking-widest uppercase">Prologue Media</div>
            <div className="text-xs text-zinc-500">
              Upload files via the <span className="text-zinc-300">Media Manager</span> first, then paste the URL here.
              Video takes priority over image for the background.
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Background Image URL
                <span className="font-normal text-zinc-500 ml-2">(.jpg · .png · .webp)</span>
              </label>
              <input
                type="text"
                value={dcPrologueBgImage}
                onChange={e => { setDcPrologueBgImage(e.target.value); syncDetectiveCase({ bgImage: e.target.value }); }}
                placeholder="/uploads/puzzles/… or CDN URL"
                className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white placeholder-gray-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Background Video URL
                <span className="font-normal text-zinc-500 ml-2">(.mp4 · .webm — plays muted &amp; looped)</span>
              </label>
              <input
                type="text"
                value={dcPrologueBgVideo}
                onChange={e => { setDcPrologueBgVideo(e.target.value); syncDetectiveCase({ bgVideo: e.target.value }); }}
                placeholder="/uploads/puzzles/… or CDN URL"
                className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white placeholder-gray-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Audio URL
                <span className="font-normal text-zinc-500 ml-2">(.mp3 · .wav · .ogg — narration or ambience)</span>
              </label>
              <input
                type="text"
                value={dcPrologueAudio}
                onChange={e => { setDcPrologueAudio(e.target.value); syncDetectiveCase({ audio: e.target.value }); }}
                placeholder="/uploads/puzzles/… or CDN URL"
                className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white placeholder-gray-500 font-mono text-xs"
              />
            </div>

            {dcPrologueAudio.trim() && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={dcPrologueAudioLoop}
                  onChange={e => { setDcPrologueAudioLoop(e.target.checked); syncDetectiveCase({ audioLoop: e.target.checked }); }}
                  className="accent-yellow-500"
                />
                Loop audio
              </label>
            )}
          </div>
        </div>

        {/* Stages JSON */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">
            Stages <span className="font-normal text-zinc-500">(JSON array)</span>
          </label>
          <div className="text-xs text-zinc-500 mb-2 space-y-0.5">
            <div>Each stage: <code className="text-yellow-400/80">id</code>, <code className="text-yellow-400/80">title</code>, <code className="text-yellow-400/80">prompt</code>, <code className="text-yellow-400/80">expectedAnswer</code> (string or string[])</div>
            <div>Optional: <code className="text-yellow-400/80">ignoreCase</code> (default true), <code className="text-yellow-400/80">ignoreWhitespace</code> (default true)</div>
          </div>
          <textarea
            value={detectiveJson}
            onChange={e => {
              const next = e.target.value;
              setDetectiveJson(next);
              try {
                JSON.parse(next);
                setDetectiveJsonError('');
                syncDetectiveCase({ stagesJson: next });
              } catch {
                setDetectiveJsonError('Invalid JSON — fix before saving.');
              }
            }}
            className="w-full px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-600 text-white font-mono text-xs h-64"
            spellCheck={false}
          />
          {detectiveJsonError ? <div className="text-sm text-red-300 mt-1">{detectiveJsonError}</div> : null}
        </div>
      </div>
    );
  };

  const renderCipherFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Cipher Type</label>
        <select
          value={asString(puzzleData.cipherType, 'caesar')}
          onChange={(e) => onDataChange('cipherType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="caesar">Caesar Cipher</option>
          <option value="atbash">Atbash Cipher</option>
          <option value="vigenere">Vigenère Cipher</option>
          <option value="substitution">Substitution Cipher</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Shift/Key (for applicable ciphers)</label>
        <input
          type="text"
          value={asString(puzzleData.key, '')}
          onChange={(e) => onDataChange('key', e.target.value)}
          placeholder="e.g., 3 for Caesar or 'SECRET' for Vigenère"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Encrypted Message</label>
        <textarea
          value={asString(puzzleData.encryptedMessage, '')}
          onChange={(e) => onDataChange('encryptedMessage', e.target.value)}
          placeholder="The encrypted message for players to solve"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
    </div>
  );

  const renderTextExtractionFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Extraction Type</label>
        <select
            value={asString(puzzleData.extractionType, 'firstLetters')}
          onChange={(e) => onDataChange('extractionType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="firstLetters">First Letters</option>
          <option value="lastLetters">Last Letters</option>
          <option value="keywords">Keywords</option>
          <option value="positions">Specific Positions</option>
          <option value="highlighted">Highlighted Words</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Source Text</label>
        <textarea
            value={asString(puzzleData.sourceText, '')}
          onChange={(e) => onDataChange('sourceText', e.target.value)}
          placeholder="The text from which players extract the answer"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Hint for Extraction (optional)</label>
        <input
          type="text"
            value={asString(puzzleData.extractionHint, '')}
          onChange={(e) => onDataChange('extractionHint', e.target.value)}
          placeholder="e.g., 'Take the first letter of each line'"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  if (puzzleType === 'jigsaw') {
    return renderJigsawFields();
  }

  if (puzzleType === 'code_master') {
    return renderCodeMasterFields();
  }

  const renderCoordinatesFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={asNumberOrEmpty(puzzleData.latitude)}
            onChange={(e) => onDataChange('latitude', e.target.value === '' ? undefined : parseFloat(e.target.value))}
            placeholder="e.g., 40.7128"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={asNumberOrEmpty(puzzleData.longitude)}
            onChange={(e) => onDataChange('longitude', e.target.value === '' ? undefined : parseFloat(e.target.value))}
            placeholder="e.g., -74.0060"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Accuracy Radius (meters)</label>
        <input
          type="number"
          value={asNumber(puzzleData.radius, 100)}
          onChange={(e) => onDataChange('radius', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Location Description</label>
        <textarea
          value={asString(puzzleData.locationDescription, '')}
          onChange={(e) => onDataChange('locationDescription', e.target.value)}
          placeholder="Describe the location clues for players"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );

  const renderImageAnalysisFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Analysis Type</label>
        <select
          value={asString(puzzleData.analysisType, 'hotZones')}
          onChange={(e) => onDataChange('analysisType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="hotZones">Click Hot Zones</option>
          <option value="colorDetection">Color Detection</option>
          <option value="patternMatching">Pattern Matching</option>
          <option value="hiddenElements">Hidden Elements</option>
          <option value="qrCode">QR Code/Barcode</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Analysis Instructions</label>
        <textarea
          value={asString(puzzleData.instructions, '')}
          onChange={(e) => onDataChange('instructions', e.target.value)}
          placeholder="Describe what players need to find or analyze"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Image URL</label>
        <input
          type="url"
          value={asString(puzzleData.imageUrl, '')}
          onChange={(e) => onDataChange('imageUrl', e.target.value)}
          placeholder="Upload image via media manager first"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  const renderAudioSpectrumFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Spectrum Type</label>
        <select
          value={asString(puzzleData.spectrumType, 'frequencies')}
          onChange={(e) => onDataChange('spectrumType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="frequencies">Frequency Analysis</option>
          <option value="spectralPattern">Spectral Pattern</option>
          <option value="waveform">Waveform Analysis</option>
          <option value="hidden">Hidden Message in Audio</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Audio URL</label>
        <input
          type="url"
          value={asString(puzzleData.audioUrl, '')}
          onChange={(e) => onDataChange('audioUrl', e.target.value)}
          placeholder="Upload audio via media manager first"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Instructions</label>
        <textarea
          value={asString(puzzleData.audioInstructions, '')}
          onChange={(e) => onDataChange('audioInstructions', e.target.value)}
          placeholder="What should players listen for or analyze?"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );

  const renderMorseCodeFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Morse Code Sequence</label>
        <textarea
          value={asString(puzzleData.morseSequence, '')}
          onChange={(e) => onDataChange('morseSequence', e.target.value)}
          placeholder="e.g., '.... . .-.. .-.. ---'"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Provide Reference Chart</label>
        <select
          value={asString(puzzleData.provideChart, 'yes')}
          onChange={(e) => onDataChange('provideChart', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="yes">Yes - Show Morse Code Chart</option>
          <option value="no">No - Players must know Morse Code</option>
          <option value="partial">Partial - Limited reference</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Audio Representation</label>
        <input
          type="url"
          value={asString(puzzleData.audioUrl, '')}
          onChange={(e) => onDataChange('audioUrl', e.target.value)}
          placeholder="Optional: Audio file of morse code (upload via media manager)"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  const renderSteganographyFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Steganography Type</label>
        <select
          value={asString(puzzleData.stegoType, 'lsb')}
          onChange={(e) => onDataChange('stegoType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="lsb">Least Significant Bit (LSB)</option>
          <option value="whitespace">Whitespace Encoding</option>
          <option value="headerData">Image Header Data</option>
          <option value="frequencyDomain">Frequency Domain</option>
          <option value="colorChannels">Color Channels</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Stego Image URL</label>
        <input
          type="url"
          value={asString(puzzleData.stegoImageUrl, '')}
          onChange={(e) => onDataChange('stegoImageUrl', e.target.value)}
          placeholder="Upload image via media manager first"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Extraction Method Description</label>
        <textarea
          value={asString(puzzleData.extractionMethod, '')}
          onChange={(e) => onDataChange('extractionMethod', e.target.value)}
          placeholder="Describe how to extract the hidden data"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Tools Hint (optional)</label>
        <input
          type="text"
          value={asString(puzzleData.toolsHint, '')}
          onChange={(e) => onDataChange('toolsHint', e.target.value)}
          placeholder="e.g., 'Try using tools like Steghide or ExifTool'"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  const renderMultiStepFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Number of Steps</label>
        <input
          type="number"
          min="2"
          max="10"
          value={asNumber(puzzleData.numSteps, 2)}
          onChange={(e) => onDataChange('numSteps', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Chain Type</label>
        <select
          value={asString(puzzleData.chainType, 'linear')}
          onChange={(e) => onDataChange('chainType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="linear">Linear - Each step leads to next</option>
          <option value="convergent">Convergent - Multiple paths to answer</option>
          <option value="branching">Branching - Different endings</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Step Descriptions</label>
        <textarea
          value={asString(puzzleData.stepDescriptions, '')}
          onChange={(e) => onDataChange('stepDescriptions', e.target.value)}
          placeholder="Describe each step separated by newlines"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Step Answers</label>
        <textarea
          value={asString(puzzleData.stepAnswers, '')}
          onChange={(e) => onDataChange('stepAnswers', e.target.value)}
          placeholder="Comma-separated answers for each step"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );


  const renderMathFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Math Type</label>
        <select
          value={asString(puzzleData.mathType, 'arithmetic')}
          onChange={(e) => onDataChange('mathType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="arithmetic">Arithmetic</option>
          <option value="algebra">Algebra</option>
          <option value="geometry">Geometry</option>
          <option value="sequence">Number Sequence</option>
          <option value="probability">Probability</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Problem Statement</label>
        <textarea
          value={asString(puzzleData.problemStatement, '')}
          onChange={(e) => onDataChange('problemStatement', e.target.value)}
          placeholder="State the math problem or equation"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Show Working (optional)</label>
        <textarea
          value={asString(puzzleData.workingExample, '')}
          onChange={(e) => onDataChange('workingExample', e.target.value)}
          placeholder="Example working/solution (for hints)"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
        />
      </div>
    </div>
  );

  const renderPatternFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Pattern Type</label>
        <select
          value={asString(puzzleData.patternType, 'visual')}
          onChange={(e) => onDataChange('patternType', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
        >
          <option value="visual">Visual Pattern</option>
          <option value="sequence">Sequence</option>
          <option value="grid">Grid Pattern</option>
          <option value="symbolic">Symbolic Pattern</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Pattern Description</label>
        <textarea
          value={asString(puzzleData.patternDescription, '')}
          onChange={(e) => onDataChange('patternDescription', e.target.value)}
          placeholder="Describe the pattern for players"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Pattern Image URL</label>
        <input
          type="url"
          value={asString(puzzleData.patternImageUrl, '')}
          onChange={(e) => onDataChange('patternImageUrl', e.target.value)}
          placeholder="Upload pattern image via media manager"
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
        />
      </div>
    </div>
  );

  // Advanced Escape Room Designer integration
  const escapeRoomOnChange = useCallback((designerData: any) => {
    onDataChange('escapeRoomData', designerData);
    if (designerData && typeof designerData.title === 'string') {
      onDataChange('title', designerData.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDataChange]);

  const renderEscapeRoomFields = () => {
    // Only render the EscapeRoomDesigner, no extra wrapper or heading
    return (
      <EscapeRoomDesigner
        initialData={puzzleData}
        editId={typeof puzzleData === 'object' && puzzleData && 'editId' in puzzleData ? (puzzleData.editId as string) : undefined}
        singlePlayerOnly={puzzleType === 'jim_wyze_case'}
        onChange={escapeRoomOnChange}
      />
    );
  };

  // ── Crack the Safe ───────────────────────────────────────────────────────
  const renderCrackSafeFields = () => {
    const safecode = asString(puzzleData.safecode, '');
    const digits = Number((puzzleData.digits ?? safecode.length) || 6);
    const maxAttempts = Number(puzzleData.maxAttempts ?? 10);
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Safe Image URL <span className="text-xs font-normal text-gray-500">(optional)</span></label>
          <input
            type="text"
            value={asString(puzzleData.safeImageUrl, '')}
            onChange={(e) => onDataChange('safeImageUrl', e.target.value)}
            placeholder="https://... paste a URL to a safe/vault image"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">If left blank, a default CSS safe graphic is shown. Paste any image URL or use your media library URL.</p>
          {asString(puzzleData.safeImageUrl, '') && (
            <img
              src={asString(puzzleData.safeImageUrl, '')}
              alt="Safe preview"
              className="mt-2 rounded-lg max-h-40 object-contain border border-slate-600"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Secret Combination</label>
          <input
            type="text"
            value={safecode}
            inputMode="numeric"
            maxLength={8}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 8);
              onDataChange('safecode', v);
              onDataChange('digits', v.length || digits);
            }}
            placeholder="e.g. 042731"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 font-mono tracking-widest"
          />
          <p className="text-xs text-gray-500 mt-1">Digits only, 4–8 characters. This is the answer players must find.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Number of Digits</label>
            <input
              type="number"
              min={4}
              max={8}
              value={digits}
              onChange={(e) => onDataChange('digits', Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Auto-set from code length</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Max Attempts</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxAttempts}
              onChange={(e) => onDataChange('maxAttempts', Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Clue / Flavor Text</label>
          <textarea
            value={asString(puzzleData.clue, '')}
            onChange={(e) => onDataChange('clue', e.target.value)}
            placeholder="e.g. The museum vault hasn't been opened in 50 years. The combination was last written in the curator's journal..."
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Surprise Message (shown when cracked)</label>
          <input
            type="text"
            value={asString(puzzleData.surpriseMessage, '')}
            onChange={(e) => onDataChange('surpriseMessage', e.target.value)}
            placeholder="e.g. 🎉 Inside the safe you find a golden key and a note that reads..."
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
        </div>

        {safecode && (
          <div className="p-3 rounded-lg text-xs text-center" style={{ background: 'rgba(56,145,166,0.1)', border: '1px solid rgba(56,145,166,0.2)', color: '#9BD1D6' }}>
            Preview: {digits}-digit safe · up to {maxAttempts} attempts · players get Mastermind-style ●○ feedback per guess
          </div>
        )}
      </div>
    );
  };

  // ── Word Trove (word search) ─────────────────────────────────────────────

  const renderWordSearchFields = () => {
    const gridSize = Number(puzzleData.gridSize ?? 12);
    const generationDifficulty = (asString(puzzleData.generationDifficulty, 'medium') || 'medium') as WordSearchGenerationDifficulty;
    const rawWords = asString(puzzleData.wordsRaw, '');
    const currentGrid = (puzzleData.grid ?? []) as string[][];
    const unplacedWords = Array.isArray(puzzleData.unplacedWords)
      ? (puzzleData.unplacedWords as string[])
      : [];
    const generationStats = (puzzleData.generationStats ?? null) as
      | { averageSharedPerPlacedWord?: number; decoysPlaced?: number; difficulty?: string }
      | null;

    const parsedWords = normalizeWordList(rawWords.split(/[\n,]+/));

    function generateGrid() {
      const { grid, placedWords, unplacedWords: failed, stats } = generateWordSearchGrid(parsedWords, gridSize, {
        difficulty: generationDifficulty,
        themedDecoys: true,
      });

      onDataChange('grid', grid);
      onDataChange('words', placedWords);
      onDataChange('unplacedWords', failed);
      onDataChange('generationStats', {
        difficulty: stats.difficulty,
        averageSharedPerPlacedWord: Number(stats.averageSharedPerPlacedWord.toFixed(2)),
        decoysPlaced: stats.decoysPlaced,
      });
      onDataChange('gridSize', gridSize);
    }

    async function generateRealWords() {
      setWsGenerating(true);
      setWsGenerateError('');
      try {
        const res = await fetch(`/api/admin/word-search/generate-words?gridSize=${gridSize}&count=${wsGenerateCount}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to generate words');
        }
        const { words } = await res.json();
        onDataChange('wordsRaw', (words as string[]).join('\n'));
        onDataChange('grid', []);
        onDataChange('unplacedWords', []);
        onDataChange('generationStats', null);
      } catch (err) {
        setWsGenerateError(err instanceof Error ? err.message : 'Failed to generate words');
      } finally {
        setWsGenerating(false);
      }
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Grid Size</label>
            <select
              value={gridSize}
              onChange={(e) => { onDataChange('gridSize', Number(e.target.value)); onDataChange('grid', []); onDataChange('unplacedWords', []); onDataChange('generationStats', null); }}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            >
              <option value={10}>10 × 10</option>
              <option value={12}>12 × 12</option>
              <option value={15}>15 × 15</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Generation Difficulty</label>
            <select
              value={generationDifficulty}
              onChange={(e) => { onDataChange('generationDifficulty', e.target.value); onDataChange('grid', []); onDataChange('generationStats', null); }}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            >
              <option value="easy">Easy (forward-heavy, fewer decoys)</option>
              <option value="medium">Medium (balanced overlap + decoys)</option>
              <option value="hard">Hard (all directions, higher overlap, denser decoys)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={generateGrid}
              disabled={parsedWords.length < 2}
              className="w-full px-4 py-2 rounded-lg font-bold text-white transition-all disabled:opacity-40"
              style={{ background: parsedWords.length >= 2 ? 'rgba(129,140,248,0.3)' : undefined, border: '1px solid rgba(129,140,248,0.5)' }}
            >
              🔀 Generate Grid
            </button>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Word Count</label>
            <input
              type="number"
              min={2}
              max={20}
              value={wsGenerateCount}
              onChange={(e) => setWsGenerateCount(Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
              className="w-24 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
          </div>
          <button
            type="button"
            onClick={generateRealWords}
            disabled={wsGenerating}
            className="px-4 py-2 rounded-lg font-bold text-white transition-all disabled:opacity-40"
            style={{ background: 'rgba(129,140,248,0.3)', border: '1px solid rgba(129,140,248,0.5)' }}
          >
            {wsGenerating ? 'Generating…' : '🎲 Generate Real Words'}
          </button>
          <p className="text-xs text-gray-500 mb-2">Picks real dictionary words no longer than the grid ({gridSize} letters).</p>
        </div>
        {wsGenerateError && <p className="text-xs text-red-400">{wsGenerateError}</p>}

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">
            Words to Find <span className="text-red-400">*</span>
            <span className="text-xs font-normal text-gray-500 ml-2">(one per line or comma-separated, min 2)</span>
          </label>
          <textarea
            rows={5}
            value={rawWords}
            onChange={(e) => { onDataChange('wordsRaw', e.target.value); onDataChange('grid', []); onDataChange('unplacedWords', []); onDataChange('generationStats', null); }}
            placeholder={"PUZZLE\nHIDDEN\nSEARCH\nWORD"}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 font-mono uppercase resize-none"
          />
          {parsedWords.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {parsedWords.length} word{parsedWords.length !== 1 ? 's' : ''}: {parsedWords.join(', ')}
            </p>
          )}
        </div>

        {generationStats && (
          <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(56,145,166,0.1)', border: '1px solid rgba(56,145,166,0.3)', color: '#bae6fd' }}>
            Style: {generationStats.difficulty ?? generationDifficulty} | Avg overlap/word: {generationStats.averageSharedPerPlacedWord ?? 0} | Decoys seeded: {generationStats.decoysPlaced ?? 0}
          </div>
        )}

        {unplacedWords.length > 0 && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
            <strong>Unplaced words:</strong> {unplacedWords.join(', ')}
            <div className="text-xs mt-1 text-rose-200">
              Increase grid size or shorten these words, then regenerate.
            </div>
          </div>
        )}

        {currentGrid.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-300 mb-2">Grid Preview ({currentGrid.length} × {currentGrid[0]?.length})</p>
            <div
              className="inline-block p-2 rounded-lg overflow-auto max-w-full"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(71,85,105,0.4)' }}
            >
              {currentGrid.map((row: string[], ri: number) => (
                <div key={ri} style={{ display: 'flex', gap: 2 }}>
                  {row.map((letter: string, ci: number) => (
                    <span
                      key={ci}
                      className="flex items-center justify-center font-mono font-bold text-xs rounded"
                      style={{ width: 20, height: 20, color: '#94a3b8', background: 'rgba(30,41,59,0.7)' }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Grid saved ✓ — regenerate any time after editing words.</p>
          </div>
        )}

        {currentGrid.length === 0 && parsedWords.length >= 2 && (
          <div className="p-3 rounded-lg text-sm text-center" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#fbbf24' }}>
            ⚠️ Click &quot;Generate Grid&quot; to create the puzzle grid before saving.
          </div>
        )}
      </div>
    );
  };

  const renderWordleFields = () => {
    const word = asString(puzzleData.word, '').toUpperCase();
    const wordLength = word.length || Number(puzzleData.wordLength ?? 5);
    const maxGuesses = Number(puzzleData.maxGuesses ?? 6);
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Secret Word <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={word}
            maxLength={10}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10);
              onDataChange('word', v);
              onDataChange('wordLength', v.length || wordLength);
            }}
            placeholder="e.g. CRANE"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 font-mono tracking-widest uppercase"
          />
          <p className="text-xs text-gray-500 mt-1">Letters only, 3–10 characters. This is the answer players must guess — it is never shown to players.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Word Length</label>
            <input
              type="number"
              min={3}
              max={10}
              value={wordLength}
              readOnly
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Auto-set from word length</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Max Guesses</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxGuesses}
              onChange={(e) => onDataChange('maxGuesses', Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Hint <span className="text-xs font-normal text-gray-500">(optional)</span></label>
          <input
            type="text"
            value={asString(puzzleData.hint, '')}
            onChange={(e) => onDataChange('hint', e.target.value)}
            placeholder="e.g. A common cooking spice"
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">Shown to players above the grid as a clue. Leave blank for no hint.</p>
        </div>

        {word && (
          <div className="p-3 rounded-lg text-xs text-center" style={{ background: 'rgba(83,141,78,0.1)', border: '1px solid rgba(83,141,78,0.3)', color: '#a7c4a4' }}>
            Preview: {wordLength}-letter word · {maxGuesses} guesses · green / yellow / grey feedback per letter
          </div>
        )}
      </div>
    );
  };

  const renderAnagramBlitzFields = () => {
    const rawWords: string[] = Array.isArray(puzzleData.words) ? (puzzleData.words as string[]) : [];
    const wordsText = rawWords.join('\n');
    const timeLimit = Number(puzzleData.timeLimit ?? 60);
    const hint = asString(puzzleData.hint, '');
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Words to Anagram <span className="text-red-400">*</span></label>
          <textarea
            value={wordsText}
            rows={6}
            onChange={(e) => {
              const words = e.target.value
                .split('\n')
                .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))
                .filter(Boolean);
              onDataChange('words', words);
            }}
            placeholder={"PLANET\nGUITAR\nMONKEY\nLEMON\nBRIDGE"}
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 font-mono uppercase"
          />
          <p className="text-xs text-gray-500 mt-1">One word per line, letters only. Players must unscramble each word. Min 3 recommended.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Time Limit (seconds)</label>
            <input
              type="number"
              min={10}
              max={600}
              value={timeLimit}
              onChange={(e) => onDataChange('timeLimit', Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Timer counts down from this value. 60s per word is a good baseline.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Hint <span className="text-xs font-normal text-gray-500">(optional)</span></label>
            <input
              type="text"
              value={hint}
              onChange={(e) => onDataChange('hint', e.target.value)}
              placeholder="e.g. All nature-themed words"
              className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
            />
          </div>
        </div>

        {rawWords.length > 0 && (
          <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(56,145,166,0.1)', border: '1px solid rgba(56,145,166,0.3)', color: '#7dd3fc' }}>
            {rawWords.length} word{rawWords.length !== 1 ? 's' : ''} · {timeLimit}s total · Words: {rawWords.join(', ')}
          </div>
        )}
      </div>
    );
  };

  // ── ARG puzzle ────────────────────────────────────────────────────────────
  const renderArgFields = () => {
    const lore = asString(puzzleData.lore, '');
    const finalMessage = asString(puzzleData.finalMessage, '');
    const rawStages = Array.isArray(puzzleData.stages) ? (puzzleData.stages as Record<string, unknown>[]) : [];

    const updateStage = (idx: number, key: string, value: unknown) => {
      const updated = rawStages.map((s, i) => i === idx ? { ...s, [key]: value } : s);
      onDataChange('stages', updated);
    };
    const addStage = () => {
      onDataChange('stages', [...rawStages, {
        id: rawStages.length + 1,
        type: 'riddle',
        title: `Stage ${rawStages.length + 1}`,
        description: '',
        riddle: '',
        answer: '',
        nudgeAfter: 5,
        nudgeText: '',
      }]);
    };
    const removeStage = (idx: number) => {
      onDataChange('stages', rawStages.filter((_, i) => i !== idx));
    };
    const moveStage = (idx: number, dir: -1 | 1) => {
      const arr = [...rawStages];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      onDataChange('stages', arr);
    };

    const STAGE_TYPE_OPTIONS = [
      { value: 'riddle', label: '🧩 Riddle / Hunt' },
      { value: 'cipher', label: '🔐 Cipher / Encoded Message' },
      { value: 'image', label: '🖼️ Image Clue' },
      { value: 'url', label: '🌐 External URL' },
      { value: 'pattern', label: '🔢 Pattern Sequence' },
    ];
    const CIPHER_OPTIONS = [
      { value: 'rot13', label: 'ROT-13' },
      { value: 'base64', label: 'Base64' },
      { value: 'morse', label: 'Morse Code' },
      { value: 'vigenere', label: 'Vigenère' },
      { value: 'binary', label: 'Binary' },
      { value: 'hex', label: 'Hexadecimal' },
      { value: 'reverse', label: 'Reversed Text' },
    ];

    const fieldCls = 'w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600 text-white placeholder-gray-500 text-sm';
    const labelCls = 'block text-xs font-semibold text-gray-400 mb-1';

    return (
      <div className="space-y-6">
        {/* Lore / intro */}
        <div>
          <label className={labelCls}>Opening Lore / Story <span className="font-normal text-gray-500">(optional — shown to player before stage 1)</span></label>
          <textarea rows={3} value={lore} onChange={(e) => onDataChange('lore', e.target.value)}
            placeholder="A signal was detected at 04:17 UTC. No one was supposed to see it…"
            className={fieldCls} />
        </div>

        {/* Stages */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-white">Stages <span className="text-red-400">*</span></label>
            <button type="button" onClick={addStage}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(56,145,166,0.2)', border: '1px solid rgba(56,145,166,0.4)', color: '#7dd3fc' }}>
              + Add Stage
            </button>
          </div>

          {rawStages.length === 0 && (
            <p className="text-xs text-gray-500 italic">No stages yet. Add at least 2 stages to create an ARG puzzle.</p>
          )}

          <div className="space-y-4">
            {rawStages.map((stage, idx) => {
              const stageType = asString(stage.type, 'riddle') as string;
              return (
                <div key={idx} className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.6)' }}>
                  {/* Stage header */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-16 shrink-0">Stage {idx + 1}</span>
                    <input
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white text-sm"
                      value={asString(stage.title, '')}
                      onChange={(e) => updateStage(idx, 'title', e.target.value)}
                      placeholder={`Stage ${idx + 1} title…`}
                    />
                    <button type="button" onClick={() => moveStage(idx, -1)} disabled={idx === 0}
                      className="px-2 py-1 rounded text-xs text-gray-400 disabled:opacity-30 hover:text-white">▲</button>
                    <button type="button" onClick={() => moveStage(idx, 1)} disabled={idx === rawStages.length - 1}
                      className="px-2 py-1 rounded text-xs text-gray-400 disabled:opacity-30 hover:text-white">▼</button>
                    <button type="button" onClick={() => removeStage(idx)}
                      className="px-2 py-1 rounded text-xs text-red-400 hover:text-red-300">✕</button>
                  </div>

                  {/* Type selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Challenge Type</label>
                      <select value={stageType} onChange={(e) => updateStage(idx, 'type', e.target.value)} className={fieldCls}>
                        {STAGE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Narrative / Flavour Text</label>
                      <input className={fieldCls} value={asString(stage.description, '')}
                        onChange={(e) => updateStage(idx, 'description', e.target.value)}
                        placeholder="The file was corrupted. Only fragments remain…" />
                    </div>
                  </div>

                  {/* Type-specific fields */}
                  {stageType === 'cipher' && (
                    <div className="space-y-3 pt-1 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Cipher Type</label>
                          <select value={asString(stage.cipherType, 'rot13')}
                            onChange={(e) => updateStage(idx, 'cipherType', e.target.value)} className={fieldCls}>
                            {CIPHER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        {asString(stage.cipherType, 'rot13') === 'vigenere' && (
                          <div>
                            <label className={labelCls}>Vigenère Key</label>
                            <input className={`${fieldCls} uppercase`} value={asString(stage.vigenereKey, '')}
                              onChange={(e) => updateStage(idx, 'vigenereKey', e.target.value.toUpperCase())}
                              placeholder="KEYWORD" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Cipher Text (shown to player)</label>
                        <textarea rows={3} className={`${fieldCls} font-mono`} value={asString(stage.cipherText, '')}
                          onChange={(e) => updateStage(idx, 'cipherText', e.target.value)}
                          placeholder="SGVsbG8gV29ybGQ=" />
                      </div>
                    </div>
                  )}

                  {stageType === 'image' && (
                    <div className="space-y-3 pt-1 border-t border-slate-700">
                      <div>
                        <label className={labelCls}>Image URL</label>
                        <input className={fieldCls} value={asString(stage.imageUrl, '')}
                          onChange={(e) => updateStage(idx, 'imageUrl', e.target.value)}
                          placeholder="https://… or /uploads/…" />
                      </div>
                      <div>
                        <label className={labelCls}>Image Caption <span className="font-normal text-gray-500">(optional)</span></label>
                        <input className={fieldCls} value={asString(stage.imageCaption, '')}
                          onChange={(e) => updateStage(idx, 'imageCaption', e.target.value)}
                          placeholder="Taken at 3am. The coordinates are somewhere in this image." />
                      </div>
                    </div>
                  )}

                  {stageType === 'url' && (
                    <div className="space-y-3 pt-1 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>URL</label>
                          <input className={fieldCls} value={asString(stage.url, '')}
                            onChange={(e) => updateStage(idx, 'url', e.target.value)}
                            placeholder="https://example.com/hidden-page" />
                        </div>
                        <div>
                          <label className={labelCls}>Link Label <span className="font-normal text-gray-500">(optional)</span></label>
                          <input className={fieldCls} value={asString(stage.urlLabel, '')}
                            onChange={(e) => updateStage(idx, 'urlLabel', e.target.value)}
                            placeholder="Access the dossier" />
                        </div>
                      </div>
                    </div>
                  )}

                  {stageType === 'riddle' && (
                    <div className="pt-1 border-t border-slate-700">
                      <label className={labelCls}>Riddle / Question Text</label>
                      <textarea rows={3} className={fieldCls} value={asString(stage.riddle, '')}
                        onChange={(e) => updateStage(idx, 'riddle', e.target.value)}
                        placeholder="I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?" />
                      <p className="text-xs text-gray-500 mt-1">Can be a traditional riddle or an internet-hunt question ("Which US president owned the most cats?").</p>
                    </div>
                  )}

                  {stageType === 'pattern' && (
                    <div className="space-y-3 pt-1 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Pattern</label>
                          <input className={`${fieldCls} font-mono`} value={asString(stage.pattern, '')}
                            onChange={(e) => updateStage(idx, 'pattern', e.target.value)}
                            placeholder="2, 3, 5, 8, 13, ?, 34" />
                        </div>
                        <div>
                          <label className={labelCls}>Pattern Label <span className="font-normal text-gray-500">(optional)</span></label>
                          <input className={fieldCls} value={asString(stage.patternLabel, '')}
                            onChange={(e) => updateStage(idx, 'patternLabel', e.target.value)}
                            placeholder="Complete the sequence" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Answer + nudge */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
                    <div>
                      <label className={labelCls}>Correct Answer <span className="text-red-400">*</span></label>
                      <input className={fieldCls} value={asString(stage.answer, '')}
                        onChange={(e) => updateStage(idx, 'answer', e.target.value)}
                        placeholder="ECHO (case-insensitive exact match)" />
                    </div>
                    <div>
                      <label className={labelCls}>Nudge After (wrong attempts)</label>
                      <input type="number" min={1} max={20} className={fieldCls}
                        value={asNumber(stage.nudgeAfter, 5)}
                        onChange={(e) => updateStage(idx, 'nudgeAfter', Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Nudge Hint Text <span className="font-normal text-gray-500">(shown after N wrong attempts)</span></label>
                    <input className={fieldCls} value={asString(stage.nudgeText, '')}
                      onChange={(e) => updateStage(idx, 'nudgeText', e.target.value)}
                      placeholder="Try looking at the page source…" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Final message */}
        <div>
          <label className={labelCls}>Final Message <span className="font-normal text-gray-500">(shown after all stages completed)</span></label>
          <input className={fieldCls} value={finalMessage}
            onChange={(e) => onDataChange('finalMessage', e.target.value)}
            placeholder="You cracked it. The truth was always hidden in plain sight." />
        </div>

        {/* Preview */}
        {rawStages.length > 0 && (
          <div className="p-3 rounded-lg text-xs space-y-1"
            style={{ background: 'rgba(56,145,166,0.1)', border: '1px solid rgba(56,145,166,0.3)', color: '#7dd3fc' }}>
            <p className="font-semibold">{rawStages.length} stage{rawStages.length !== 1 ? 's' : ''} configured</p>
            {rawStages.map((s, i) => (
              <p key={i}>Stage {i + 1}: [{asString(s.type, '?').toUpperCase()}] {asString(s.title, '')} — answer: "{asString(s.answer, '(missing)')}"</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Blackout ──────────────────────────────────────────────────────────────
  //
  // Admin writes the document with [[double brackets]] around words to redact.
  // The designer parses those markers live, shows a per-redaction config panel,
  // and produces the data blob the player-side renderer consumes.

  const renderBlackoutFields = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEncodedClue, getCipherLabel, CIPHER_OPTIONS } = require('@/lib/blackout-ciphers') as typeof import('@/lib/blackout-ciphers');
    const rawDocument = asString(puzzleData.rawDocument, '');
    const documentTitle = asString(puzzleData.documentTitle, '');
    const classification = asString(puzzleData.classification, 'CLASSIFIED');
    const flavorText = asString(puzzleData.flavorText, '');
    const successMessage = asString(puzzleData.successMessage, '');
    const answerMode = asString(puzzleData.answerMode, 'free_text') as 'free_text' | 'multiple_choice';
    const stampSrc     = asString(puzzleData.stampSrc, '');
    const stampOpacity = typeof puzzleData.stampOpacity === 'number' ? puzzleData.stampOpacity : 0.25;
    const stampX       = typeof puzzleData.stampX === 'number' ? puzzleData.stampX : 50;
    const stampY       = typeof puzzleData.stampY === 'number' ? puzzleData.stampY : 50;
    const stampScale   = typeof puzzleData.stampScale === 'number' ? puzzleData.stampScale : 1;

    // Parse [[word or phrase]] markers from rawDocument
    const redactionRegex = /\[\[(.+?)\]\]/g;
    const parsedWords: string[] = [];
    let match: RegExpExecArray | null;
    const tempRegex = new RegExp(redactionRegex.source, 'g');
    while ((match = tempRegex.exec(rawDocument)) !== null) {
      parsedWords.push(match[1]);
    }

    // Merge with existing redaction metadata (hints, options)
    const existingMeta: Record<string, unknown>[] = Array.isArray(puzzleData.redactions)
      ? (puzzleData.redactions as Record<string, unknown>[])
      : [];

    const redactions: Record<string, unknown>[] = parsedWords.map((word, i) => ({
      placeholder: word,
      hint: asString(existingMeta[i]?.hint, ''),
      options: Array.isArray(existingMeta[i]?.options) ? existingMeta[i].options : [],
      cipherType: asString(existingMeta[i]?.cipherType, 'none'),
      cipherShift: typeof existingMeta[i]?.cipherShift === 'number' ? existingMeta[i].cipherShift : 13,
      cipherKey: asString(existingMeta[i]?.cipherKey, 'KEY'),
    }));

    // Update parent whenever rawDocument changes
    const updateRedactionsFromDoc = (newDoc: string) => {
      onDataChange('rawDocument', newDoc);
      const r = new RegExp(/\[\[(.+?)\]\]/g);
      const words: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = r.exec(newDoc)) !== null) words.push(m[1]);
      const existing: Record<string, unknown>[] = Array.isArray(puzzleData.redactions)
        ? (puzzleData.redactions as Record<string, unknown>[])
        : [];
      onDataChange('redactions', words.map((word, i) => ({
        placeholder: word,
        hint: asString(existing[i]?.hint, ''),
        options: Array.isArray(existing[i]?.options) ? existing[i].options : [],
        cipherType: asString(existing[i]?.cipherType, 'none'),
        cipherShift: typeof existing[i]?.cipherShift === 'number' ? existing[i].cipherShift : 13,
        cipherKey: asString(existing[i]?.cipherKey, 'KEY'),
      })));
    };

    const updateRedactionMeta = (idx: number, key: string, value: unknown) => {
      const next = redactions.map((r, i) => i === idx ? { ...r, [key]: value } : r);
      onDataChange('redactions', next);
    };

    const updateRedactionOptions = (idx: number, raw: string) => {
      const opts = raw.split('\n').map((s) => s.trim()).filter(Boolean);
      updateRedactionMeta(idx, 'options', opts);
    };

    // Preview: replace [[word]] with ████ blocks for visual preview
    const previewText = rawDocument.replace(/\[\[(.+?)\]\]/g, (_, w) =>
      '█'.repeat(Math.max(3, Math.min(w.length, 12)))
    );

    const CLASSIFICATION_OPTIONS = [
      'UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP SECRET', 'TS // SCI',
      'EYES ONLY', 'RESTRICTED', 'INTERNAL', 'CLASSIFIED',
    ];

    const fieldCls = 'w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600 text-white placeholder-gray-500 text-sm';
    const labelCls = 'block text-xs font-semibold text-gray-400 mb-1';

    return (
      <div className="space-y-6">

        {/* How-to hint */}
        <div className="rounded-lg p-3 text-xs"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
          <p className="font-bold mb-1">⬛ How Blackout works</p>
          <p>Write the document in the text area below. Wrap any word or phrase you want <strong>redacted</strong> in <code>[[double brackets]]</code>.</p>
          <p className="mt-1">Example: <code>The agent known as [[NIGHTFALL]] was last seen in [[Berlin]] on [[March 14th]].</code></p>
          <p className="mt-1">Players see black bars and must guess the hidden word. Each redaction can have its own hint and (optionally) multiple-choice options.</p>
        </div>

        {/* Classification + Title */}
        <div className="grid grid-cols-[160px_1fr] gap-4">
          <div>
            <label className={labelCls}>Classification Level</label>
            <select
              value={classification}
              onChange={(e) => onDataChange('classification', e.target.value)}
              className={fieldCls}
            >
              {CLASSIFICATION_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Document Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => onDataChange('documentTitle', e.target.value)}
              placeholder="e.g. OPERATION NIGHTFALL — FIELD REPORT #7"
              className={fieldCls}
            />
          </div>
        </div>

        {/* Flavor text */}
        <div>
          <label className={labelCls}>Flavor Text <span className="font-normal text-gray-500">(optional — shown above the document)</span></label>
          <textarea
            rows={2}
            value={flavorText}
            onChange={(e) => onDataChange('flavorText', e.target.value)}
            placeholder="A partially-declassified file surfaced on the dark web. Key words have been suppressed. How good is your memory?"
            className={fieldCls}
          />
        </div>

        {/* Stamp / Watermark */}
        <div>
          <label className={labelCls}>Document Stamp / Watermark <span className="font-normal text-gray-500">(optional — overlaid on the paper document)</span></label>
          <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.5)' }}>
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-2">
                <label
                  className="cursor-pointer inline-block px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.5)' }}
                >
                  {stampSrc ? '↑ Replace Image' : '↑ Upload Stamp Image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => onDataChange('stampSrc', ev.target?.result as string);
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                {stampSrc && (
                  <button
                    type="button"
                    onClick={() => onDataChange('stampSrc', '')}
                    className="px-3 py-2 rounded-lg text-xs text-red-400"
                    style={{ border: '1px solid rgba(239,68,68,0.4)' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {stampSrc && (
                <div style={{ width: 80, height: 80, background: '#e8dcc8', border: '1px solid #c5b89a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stampSrc} alt="stamp preview" style={{ maxWidth: '100%', maxHeight: '100%', opacity: stampOpacity }} />
                </div>
              )}
            </div>
            {stampSrc && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Opacity — {Math.round(stampOpacity * 100)}%</label>
                  <input
                    type="range" min={5} max={100} step={5}
                    value={Math.round(stampOpacity * 100)}
                    onChange={(e) => onDataChange('stampOpacity', Number(e.target.value) / 100)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Position X — {stampX}%</label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={stampX}
                    onChange={(e) => onDataChange('stampX', Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Position Y — {stampY}%</label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={stampY}
                    onChange={(e) => onDataChange('stampY', Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Scale — {stampScale.toFixed(2)}×</label>
                  <input
                    type="range" min={25} max={300} step={5}
                    value={Math.round(stampScale * 100)}
                    onChange={(e) => onDataChange('stampScale', Number(e.target.value) / 100)}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Answer mode */}
        <div className="flex gap-6 items-center">
          <span className={labelCls} style={{ marginBottom: 0 }}>Answer Mode</span>
          {(['free_text', 'multiple_choice'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="answerMode"
                value={mode}
                checked={answerMode === mode}
                onChange={() => onDataChange('answerMode', mode)}
                className="h-4 w-4"
              />
              {mode === 'free_text' ? '🔡 Free text (players type)' : '🔘 Multiple choice (you provide options per redaction)'}
            </label>
          ))}
        </div>

        {/* Document text area */}
        <div>
          <label className={labelCls}>
            Document Text <span className="text-red-400">*</span>
            <span className="font-normal text-gray-500 ml-2">— wrap words to redact in [[double brackets]]</span>
          </label>
          <textarea
            rows={10}
            value={rawDocument}
            onChange={(e) => updateRedactionsFromDoc(e.target.value)}
            placeholder={
`INTELLIGENCE REPORT — CASE 47-C

Subject: [[Marcus Holt]], 38, male. Last known alias: [[ECHO-9]].

On [[14 March]] at approximately [[21:15]], subject was observed entering the Ashwood Hotel using a key card registered under the name [[Elena Voss]]. He ascended to floor [[seven]] carrying a brown leather briefcase.

At [[23:30]], security found the room vacant. The window was unlatched. A single playing card — the [[eight]] of clubs — was left on the pillow.`
            }
            className={`${fieldCls} font-mono text-xs resize-y`}
            spellCheck={false}
          />
          <p className="text-xs text-gray-500 mt-1">
            {parsedWords.length > 0
              ? `${parsedWords.length} redaction${parsedWords.length !== 1 ? 's' : ''} detected: ${parsedWords.map((w) => `[[${w}]]`).join(', ')}`
              : 'No [[redactions]] found yet.'}
          </p>
        </div>

        {/* Live preview */}
        {rawDocument && (
          <div>
            <label className={labelCls}>Player Preview</label>
            <div
              className="rounded-lg p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed"
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(71,85,105,0.5)',
                color: '#94a3b8',
              }}
            >
              <div style={{ color: '#ef4444', fontWeight: 700, letterSpacing: '0.15em', fontSize: 10, marginBottom: 8 }}>
                ⚠ {classification}
              </div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 12, fontSize: 11, letterSpacing: '0.05em' }}>
                {documentTitle || 'UNTITLED DOCUMENT'}
              </div>
              {previewText}
            </div>
          </div>
        )}

        {/* Per-redaction settings */}
        {redactions.length > 0 && (
          <div>
            <label className="block text-sm font-bold text-white mb-3">
              Redaction Settings
            </label>
            <div className="space-y-4">
              {redactions.map((r, idx) => (
                <div
                  key={idx}
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.5)' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-mono font-bold px-2 py-1 rounded"
                      style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}
                    >
                      [{idx + 1}]
                    </span>
                    <span
                      className="inline-flex items-center px-3 py-1 rounded text-xs font-bold tracking-widest"
                      style={{ background: '#0f172a', color: '#0f172a', border: '2px solid #334155', userSelect: 'none' }}
                      title={`Hidden word: ${r.placeholder}`}
                    >
                      {'█'.repeat(Math.max(3, Math.min(String(r.placeholder).length, 12)))}
                    </span>
                    <code className="text-xs text-purple-300 ml-1">&ldquo;{String(r.placeholder)}&rdquo;</code>
                  </div>

                  {/* Cipher type selector (only for free_text mode) */}
                  {answerMode !== 'multiple_choice' && (() => {
                    const ct = asString(r.cipherType, 'none');
                    const cs = typeof r.cipherShift === 'number' ? r.cipherShift : 13;
                    const ck = asString(r.cipherKey, 'KEY');
                    const encoded = ct !== 'none' ? getEncodedClue(String(r.placeholder), ct as import('@/lib/blackout-ciphers').CipherType, cs, ck) : '';
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                          <div>
                            <label className={labelCls}>Cipher Type <span className="font-normal text-gray-500">(determines what decode clue is shown to the player)</span></label>
                            <select
                              value={ct}
                              onChange={e => updateRedactionMeta(idx, 'cipherType', e.target.value)}
                              className={fieldCls}
                            >
                              {CIPHER_OPTIONS.map((o: {value: string; label: string}) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          {ct === 'caesar' && (
                            <div style={{ width: '80px' }}>
                              <label className={labelCls}>Key (shift)</label>
                              <input
                                type="number"
                                min={1} max={25}
                                value={cs}
                                onChange={e => updateRedactionMeta(idx, 'cipherShift', Number(e.target.value))}
                                className={fieldCls}
                              />
                            </div>
                          )}
                          {ct === 'vigenere' && (
                            <div style={{ width: '120px' }}>
                              <label className={labelCls}>Keyword</label>
                              <input
                                type="text"
                                value={ck}
                                onChange={e => updateRedactionMeta(idx, 'cipherKey', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                                placeholder="KEY"
                                className={fieldCls}
                                style={{ textTransform: 'uppercase' }}
                              />
                            </div>
                          )}
                        </div>
                        {ct !== 'none' && encoded && (
                          <div>
                            <label className={labelCls}>Encoded clue preview <span className="font-normal text-gray-500">(this is what players will see)</span></label>
                            <div
                              className="rounded p-3 font-mono text-xs tracking-wider"
                              style={{ background: '#050a05', border: '1px solid #1a4a1a', color: '#4dff4d' }}
                            >
                              <div style={{ color: '#888', fontSize: '9px', letterSpacing: '0.15em', marginBottom: '4px' }}>
                                {getCipherLabel(ct as import('@/lib/blackout-ciphers').CipherType, cs, ck)}
                              </div>
                              {encoded}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div>
                    <label className={labelCls}>Hint <span className="font-normal text-gray-500">(optional — shown after wrong attempts if cipher type is "None")</span></label>
                    <input
                      type="text"
                      value={asString(r.hint, '')}
                      onChange={(e) => updateRedactionMeta(idx, 'hint', e.target.value)}
                      placeholder="e.g. A European capital city"
                      className={fieldCls}
                    />
                  </div>

                  {answerMode === 'multiple_choice' && (
                    <div>
                      <label className={labelCls}>
                        Multiple Choice Options <span className="font-normal text-gray-500">(one per line — include the correct answer among them)</span>
                      </label>
                      <textarea
                        rows={4}
                        value={Array.isArray(r.options) ? (r.options as string[]).join('\n') : ''}
                        onChange={(e) => updateRedactionOptions(idx, e.target.value)}
                        placeholder={`${r.placeholder}\nWrong option A\nWrong option B\nWrong option C`}
                        className={`${fieldCls} font-mono`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The correct answer is always <strong>&ldquo;{String(r.placeholder)}&rdquo;</strong> — it must appear in this list.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success message */}
        <div>
          <label className={labelCls}>Success Message <span className="font-normal text-gray-500">(shown when all redactions are solved)</span></label>
          <input
            type="text"
            value={successMessage}
            onChange={(e) => onDataChange('successMessage', e.target.value)}
            placeholder="e.g. File declassified. The truth was always hidden in plain sight."
            className={fieldCls}
          />
        </div>
      </div>
    );
  };

  // ── Crossword ─────────────────────────────────────────────────────────────

  const renderCrosswordFields = () => {
    interface RawClue {
      number: number;
      row: number;
      col: number;
      length: number;
      answer: string;
      text: string;
    }

    interface Slot {
      number: number;
      row: number;
      col: number;
      length: number;
    }

    interface EditorClue extends Slot {
      direction: 'across' | 'down';
      answer: string;
      text: string;
    }

    type SeedEntry = CrosswordGeneratorSeedEntry;

    interface CrosswordGenerationOptions {
      fillPoolEntries?: SeedEntry[];
    }

    const fieldCls = 'w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600 text-white placeholder-gray-500 text-sm';
    const labelCls = 'block text-xs font-semibold text-gray-400 mb-1';
    const MIN_GRID = 3;
    const MAX_GRID = 30;

    const clampInt = (value: number, min: number, max: number): number => {
      return Math.max(min, Math.min(max, value));
    };

    const normalizeAnswer = (value: unknown): string => {
      return String(value ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    };

    const createBlankLayout = (rows: number, cols: number): string[] => {
      return Array.from({ length: rows }, () => '.'.repeat(cols));
    };

    const normalizeLayout = (rowsInput: string[], rows: number, cols: number): string[] => {
      const safeRows = clampInt(rows, MIN_GRID, MAX_GRID);
      const safeCols = clampInt(cols, MIN_GRID, MAX_GRID);

      return Array.from({ length: safeRows }, (_, rowIndex) => {
        const sourceRow = rowsInput[rowIndex] ?? '';
        const cells = Array.from({ length: safeCols }, (_, colIndex) => {
          return sourceRow[colIndex] === '#' ? '#' : '.';
        });
        return cells.join('');
      });
    };

    const parseLegacyGridText = (raw: string): string[] => {
      if (!raw.trim()) return [];

      const lines = raw
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) =>
          line
            .split(/\s+/)
            .map((cell) => (cell === '#' ? '#' : '.'))
            .join('')
        );

      const width = lines[0]?.length ?? 0;
      if (width === 0 || lines.some((line) => line.length !== width)) {
        return [];
      }

      return lines;
    };

    const toClueList = (raw: unknown): RawClue[] => {
      if (!Array.isArray(raw)) return [];

      return raw
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const rec = item as Record<string, unknown>;

          const number = Math.trunc(asNumber(rec.number, -1));
          const row = Math.trunc(asNumber(rec.row, -1));
          const col = Math.trunc(asNumber(rec.col, -1));
          const answer = normalizeAnswer(rec.answer);
          const rawLength = Math.trunc(asNumber(rec.length, answer.length));
          const length = rawLength > 0 ? rawLength : answer.length;
          const text = asString(rec.text, '');

          if (number <= 0 || row < 0 || col < 0 || length <= 0) return null;

          return {
            number,
            row,
            col,
            length,
            answer: answer.slice(0, length),
            text,
          };
        })
        .filter((clue): clue is RawClue => clue != null);
    };

    const buildLayoutFromClues = (
      across: RawClue[],
      down: RawClue[],
      fallbackRows: number,
      fallbackCols: number
    ): string[] => {
      let rows = fallbackRows;
      let cols = fallbackCols;

      for (const clue of across) {
        rows = Math.max(rows, clue.row + 1);
        cols = Math.max(cols, clue.col + clue.length);
      }

      for (const clue of down) {
        rows = Math.max(rows, clue.row + clue.length);
        cols = Math.max(cols, clue.col + 1);
      }

      rows = clampInt(rows || 15, MIN_GRID, MAX_GRID);
      cols = clampInt(cols || rows, MIN_GRID, MAX_GRID);

      const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => '#'));

      for (const clue of across) {
        for (let i = 0; i < clue.length; i += 1) {
          if (clue.row < rows && clue.col + i < cols) {
            grid[clue.row][clue.col + i] = '.';
          }
        }
      }

      for (const clue of down) {
        for (let i = 0; i < clue.length; i += 1) {
          if (clue.row + i < rows && clue.col < cols) {
            grid[clue.row + i][clue.col] = '.';
          }
        }
      }

      return grid.map((row) => row.join(''));
    };

    const extractSlots = (layoutRows: string[]): { across: Slot[]; down: Slot[] } => {
      const rows = layoutRows.length;
      const cols = layoutRows[0]?.length ?? 0;

      const isWhite = (row: number, col: number): boolean => {
        return row >= 0 && row < rows && col >= 0 && col < cols && layoutRows[row][col] !== '#';
      };

      const runLength = (row: number, col: number, direction: 'across' | 'down'): number => {
        let r = row;
        let c = col;
        let length = 0;

        while (isWhite(r, c)) {
          length += 1;
          if (direction === 'across') c += 1;
          else r += 1;
        }

        return length;
      };

      const across: Slot[] = [];
      const down: Slot[] = [];
      let nextNumber = 1;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (!isWhite(row, col)) continue;

          const leftBlack = col === 0 || !isWhite(row, col - 1);
          const upBlack = row === 0 || !isWhite(row - 1, col);

          const acrossLength = leftBlack ? runLength(row, col, 'across') : 0;
          const downLength = upBlack ? runLength(row, col, 'down') : 0;

          const startsAcross = leftBlack && acrossLength >= 3;
          const startsDown = upBlack && downLength >= 3;

          if (!startsAcross && !startsDown) continue;

          if (startsAcross) {
            across.push({ number: nextNumber, row, col, length: acrossLength });
          }
          if (startsDown) {
            down.push({ number: nextNumber, row, col, length: downLength });
          }

          nextNumber += 1;
        }
      }

      return { across, down };
    };

    const mergeSlotsWithExisting = (
      slots: Slot[],
      direction: 'across' | 'down',
      existingClues: Array<RawClue | EditorClue>
    ): EditorClue[] => {
      const byPosition = new Map<string, RawClue | EditorClue>();
      const byNumber = new Map<number, RawClue | EditorClue>();

      for (const clue of existingClues) {
        byPosition.set(`${clue.row}:${clue.col}`, clue);
        if (!byNumber.has(clue.number)) {
          byNumber.set(clue.number, clue);
        }
      }

      return slots.map((slot) => {
        const source =
          byPosition.get(`${slot.row}:${slot.col}`) ?? byNumber.get(slot.number);
        const answer = normalizeAnswer(source?.answer).slice(0, slot.length);

        return {
          ...slot,
          direction,
          answer,
          text: asString(source?.text, ''),
        };
      });
    };

    const computeBlackSquareRatio = (layoutRows: string[]): number => {
      const rows = layoutRows.length;
      const cols = layoutRows[0]?.length ?? 0;
      const total = rows * cols;
      if (total === 0) return 0;

      let blackCount = 0;
      for (const row of layoutRows) {
        for (const cell of row) {
          if (cell === '#') blackCount += 1;
        }
      }

      return blackCount / total;
    };

    const parseSeedEntries = (raw: string): SeedEntry[] => {
      if (!raw.trim()) return [];

      const byAnswer = new Map<string, string>();
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('//'));

      for (const line of lines) {
        const parts = line.split('|');
        const answerRaw = parts[0] ?? '';
        const clueRaw = parts.slice(1).join('|');
        const answer = normalizeAnswer(answerRaw);
        const text = asString(clueRaw, '').trim();
        if (answer.length < 3 || !text) continue;
        if (!byAnswer.has(answer)) {
          byAnswer.set(answer, text);
        }
      }

      return Array.from(byAnswer.entries()).map(([answer, text]) => ({
        answer,
        text,
      }));
    };

    const TOPIC_LABELS: Record<string, string> = {
      food: 'Food and Cooking',
      space: 'Space and Astronomy',
      ocean: 'Ocean and Marine Life',
      sports: 'Sports and Athletics',
      technology: 'Technology and Computing',
      history: 'History and Civilization',
    };

    const TOPIC_SEED_BANK: Record<string, SeedEntry[]> = {
      food: [
        { answer: 'APPLE', text: 'Common red or green fruit.' },
        { answer: 'ORANGE', text: 'Citrus fruit named after a color.' },
        { answer: 'BANANA', text: 'Long curved yellow fruit.' },
        { answer: 'GRAPE', text: 'Small fruit often used in wine.' },
        { answer: 'PEACH', text: 'Fuzzy stone fruit with sweet flesh.' },
        { answer: 'PEAR', text: 'Bell-shaped juicy fruit.' },
        { answer: 'CHERRY', text: 'Small red fruit with a pit.' },
        { answer: 'LEMON', text: 'Sour yellow citrus fruit.' },
        { answer: 'LIME', text: 'Small green citrus fruit.' },
        { answer: 'MANGO', text: 'Tropical fruit with orange flesh.' },
        { answer: 'PAPAYA', text: 'Tropical fruit with black seeds.' },
        { answer: 'ALMOND', text: 'Popular nut used in milk alternatives.' },
        { answer: 'WALNUT', text: 'Wrinkled nut in a hard shell.' },
        { answer: 'CASHEW', text: 'Curved nut often roasted and salted.' },
        { answer: 'PEANUT', text: 'Legume commonly found in butter spread.' },
        { answer: 'OATMEAL', text: 'Warm porridge made from oats.' },
        { answer: 'CEREAL', text: 'Breakfast food often eaten with milk.' },
        { answer: 'TOAST', text: 'Bread browned with dry heat.' },
        { answer: 'BUTTER', text: 'Dairy spread made from churned cream.' },
        { answer: 'HONEY', text: 'Sweet syrup produced by bees.' },
        { answer: 'YOGURT', text: 'Cultured dairy product.' },
        { answer: 'CHEESE', text: 'Aged or fresh product made from milk curds.' },
        { answer: 'BREAD', text: 'Staple baked food made from flour.' },
        { answer: 'MUFFIN', text: 'Small single-serving quick bread.' },
        { answer: 'BAGEL', text: 'Ring-shaped bread with a chewy texture.' },
        { answer: 'PANCAKE', text: 'Flat cake cooked on a griddle.' },
        { answer: 'WAFFLE', text: 'Breakfast cake with a grid pattern.' },
        { answer: 'OMELET', text: 'Folded egg dish with fillings.' },
        { answer: 'BACON', text: 'Cured pork often served at breakfast.' },
        { answer: 'SAUSAGE', text: 'Seasoned ground meat in a casing.' },
        { answer: 'COFFEE', text: 'Caffeinated drink brewed from roasted beans.' },
        { answer: 'TEA', text: 'Drink made by steeping leaves in hot water.' },
        { answer: 'JUICE', text: 'Drink extracted from fruits or vegetables.' },
        { answer: 'SMOOTHIE', text: 'Thick blended drink of fruit or yogurt.' },
        { answer: 'KETTLE', text: 'Vessel used to boil water.' },
        { answer: 'SPATULA', text: 'Flat tool used for flipping food.' },
        { answer: 'SKILLET', text: 'Frying pan with sloped sides.' },
        { answer: 'SAUCEPAN', text: 'Deep pan used for liquids and sauces.' },
        { answer: 'RECIPE', text: 'Set of instructions for preparing a dish.' },
        { answer: 'PANTRY', text: 'Storage space for dry food items.' },
      ],
      space: [
        { answer: 'SUN', text: 'Star at the center of our solar system.' },
        { answer: 'SKY', text: 'The visible dome above Earth.' },
        { answer: 'ISS', text: 'Abbreviation for the International Space Station.' },
        { answer: 'EVA', text: 'Spacewalk performed outside a spacecraft.' },
        { answer: 'UFO', text: 'Common term for an unidentified flying object.' },
        { answer: 'ION', text: 'Electrically charged atom or molecule.' },
        { answer: 'EON', text: 'Immensely long span of time.' },
        { answer: 'PLANET', text: 'Large celestial body that orbits a star.' },
        { answer: 'EARTH', text: 'Our home planet in the solar system.' },
        { answer: 'MOON', text: 'Natural satellite orbiting a planet.' },
        { answer: 'SATURN', text: 'Planet famous for its rings.' },
        { answer: 'JUPITER', text: 'Largest planet in the solar system.' },
        { answer: 'MERCURY', text: 'Smallest planet and closest to the Sun.' },
        { answer: 'VENUS', text: 'Bright planet often called Earths sister.' },
        { answer: 'MARS', text: 'Red planet with giant volcanoes.' },
        { answer: 'NEPTUNE', text: 'Blue ice giant far from the Sun.' },
        { answer: 'URANUS', text: 'Planet that rotates on its side.' },
        { answer: 'PLUTO', text: 'Dwarf planet in the outer solar system.' },
        { answer: 'COMET', text: 'Icy object that forms a glowing tail near the Sun.' },
        { answer: 'ASTEROID', text: 'Rocky body orbiting mostly between Mars and Jupiter.' },
        { answer: 'GALAXY', text: 'Vast system of stars, gas, and dark matter.' },
        { answer: 'NEBULA', text: 'Cloud of gas and dust in space.' },
        { answer: 'ORBIT', text: 'Path of one body around another.' },
        { answer: 'NOVA', text: 'Sudden brightening of a star.' },
        { answer: 'VOID', text: 'Seemingly empty expanse of space.' },
        { answer: 'AXIS', text: 'Imaginary line about which a body rotates.' },
        { answer: 'ECLIPSE', text: 'Event when one celestial body blocks another.' },
        { answer: 'METEOR', text: 'Streak of light from burning space debris.' },
        { answer: 'METEORITE', text: 'Space rock that reaches the ground.' },
        { answer: 'TELESCOPE', text: 'Instrument used to observe distant objects.' },
        { answer: 'COSMOS', text: 'The universe regarded as an ordered system.' },
        { answer: 'STAR', text: 'Luminous sphere of plasma in space.' },
        { answer: 'ORION', text: 'Prominent constellation known for its belt.' },
        { answer: 'VEGA', text: 'Bright star in the constellation Lyra.' },
        { answer: 'ALTAIR', text: 'Bright star in the constellation Aquila.' },
        { answer: 'SIRIUS', text: 'Brightest star visible in Earths night sky.' },
        { answer: 'POLARIS', text: 'North Star used for navigation.' },
        { answer: 'SUPERNOVA', text: 'Explosive death of a massive star.' },
        { answer: 'QUASAR', text: 'Extremely bright active galactic nucleus.' },
        { answer: 'ROCKET', text: 'Vehicle propelled by exhaust thrust.' },
        { answer: 'SHUTTLE', text: 'Reusable spacecraft used for orbital missions.' },
        { answer: 'MODULE', text: 'Section of a spacecraft or station.' },
        { answer: 'ASTRONAUT', text: 'Person trained to travel in space.' },
        { answer: 'COSMONAUT', text: 'Space traveler trained in a Russian program.' },
        { answer: 'SPACECRAFT', text: 'Vehicle designed for travel beyond Earth.' },
        { answer: 'SATELLITE', text: 'Object that orbits a planet or moon.' },
        { answer: 'LAUNCH', text: 'Initial sending of a rocket into flight.' },
        { answer: 'PAYLOAD', text: 'Cargo carried by a rocket or spacecraft.' },
        { answer: 'NOZZLE', text: 'Rocket engine part that accelerates exhaust.' },
        { answer: 'THRUST', text: 'Forward force produced by rocket engines.' },
        { answer: 'LUNAR', text: 'Related to the Moon.' },
        { answer: 'SOLAR', text: 'Related to the Sun.' },
        { answer: 'COSMIC', text: 'Relating to the universe as a whole.' },
        { answer: 'STARDUST', text: 'Fine particles originating from stars.' },
        { answer: 'EXOPLANET', text: 'Planet that orbits a star beyond our Sun.' },
        { answer: 'REDSHIFT', text: 'Spectral shift indicating objects moving away.' },
        { answer: 'HORIZON', text: 'Boundary line of observation, as in event horizon.' },
        { answer: 'PARSEC', text: 'Astronomical unit of distance.' },
        { answer: 'LIGHTYEAR', text: 'Distance light travels in one year.' },
        { answer: 'ROVER', text: 'Vehicle used to explore another world surface.' },
        { answer: 'PROBE', text: 'Uncrewed spacecraft sent to gather data.' },
        { answer: 'FUSION', text: 'Process powering stars by combining nuclei.' },
        { answer: 'PLASMA', text: 'Ionized gas common in stars.' },
        { answer: 'PHOTON', text: 'Particle of light.' },
        { answer: 'BINARY', text: 'System of two stars orbiting each other.' },
        { answer: 'ORRERY', text: 'Mechanical model of the solar system.' },
        { answer: 'ATLAS', text: 'Name used by a long-running rocket family.' },
        { answer: 'ZENITH', text: 'Point directly overhead in the sky.' },
        { answer: 'NADIR', text: 'Point directly below an observer.' },
        { answer: 'APOGEE', text: 'Farthest point from Earth in an orbit.' },
        { answer: 'PERIGEE', text: 'Nearest point to Earth in an orbit.' },
        { answer: 'APSIS', text: 'Term for orbital extreme points like apogee.' },
        { answer: 'ECLIPTIC', text: 'Apparent yearly path of the Sun on the sky.' },
        { answer: 'SPECTRUM', text: 'Range of electromagnetic wavelengths.' },
        { answer: 'SUNSPOT', text: 'Cooler, darker patch on the Suns surface.' },
        { answer: 'TELEMETRY', text: 'Transmission of measurements from distant instruments.' },
        { answer: 'ASTROLABE', text: 'Historic instrument used to measure celestial positions.' },
        { answer: 'CERES', text: 'Largest object in the asteroid belt.' },
        { answer: 'TITAN', text: 'Largest moon of Saturn.' },
        { answer: 'EUROPA', text: 'Icy moon of Jupiter with a hidden ocean.' },
        { answer: 'APOLLO', text: 'Program that landed humans on the Moon.' },
        { answer: 'GEMINI', text: 'NASA program between Mercury and Apollo.' },
        { answer: 'CRATER', text: 'Bowl-shaped impact feature on a surface.' },
        { answer: 'GRAVITY', text: 'Force that attracts masses toward each other.' },
      ],
      ocean: [
        { answer: 'OCEAN', text: 'Large body of salt water covering Earth.' },
        { answer: 'TIDAL', text: 'Related to the rise and fall of sea levels.' },
        { answer: 'CORAL', text: 'Marine invertebrate that forms reefs.' },
        { answer: 'REEF', text: 'Ridge of rock or coral near the sea surface.' },
        { answer: 'KELP', text: 'Large brown seaweed found in cold waters.' },
        { answer: 'ALGAE', text: 'Simple aquatic photosynthetic organisms.' },
        { answer: 'PLANKTON', text: 'Tiny drifting organisms in water.' },
        { answer: 'DOLPHIN', text: 'Intelligent marine mammal known for clicks and whistles.' },
        { answer: 'WHALE', text: 'Large marine mammal that breathes air.' },
        { answer: 'SHARK', text: 'Cartilaginous fish with rows of teeth.' },
        { answer: 'RAY', text: 'Flat-bodied relative of sharks.' },
        { answer: 'TURTLE', text: 'Reptile with a shell, including sea species.' },
        { answer: 'SEAHORSE', text: 'Small upright fish with a curled tail.' },
        { answer: 'OCTOPUS', text: 'Eight-armed cephalopod.' },
        { answer: 'SQUID', text: 'Fast-swimming cephalopod with tentacles.' },
        { answer: 'JELLYFISH', text: 'Gelatinous drifting animal with stinging tentacles.' },
        { answer: 'ANCHOVY', text: 'Small schooling fish used in cooking.' },
        { answer: 'SALMON', text: 'Fish known for migrating upstream to spawn.' },
        { answer: 'TUNA', text: 'Fast ocean fish popular in seafood dishes.' },
        { answer: 'LOBSTER', text: 'Crustacean with large claws.' },
        { answer: 'CRAB', text: 'Crustacean with a broad shell and pincers.' },
        { answer: 'SEAL', text: 'Marine mammal that hauls out on shore.' },
        { answer: 'OTTER', text: 'Aquatic mammal known for tool use.' },
        { answer: 'CURRENT', text: 'Continuous directional movement of seawater.' },
        { answer: 'TSUNAMI', text: 'Large ocean wave caused by seismic activity.' },
        { answer: 'ESTUARY', text: 'Coastal area where river water meets the sea.' },
        { answer: 'HARBOR', text: 'Sheltered place where boats can anchor.' },
        { answer: 'BAY', text: 'Body of water partly enclosed by land.' },
        { answer: 'ISLAND', text: 'Land surrounded by water.' },
        { answer: 'LAGOON', text: 'Shallow body of water separated from larger water.' },
      ],
      sports: [
        { answer: 'SPORT', text: 'Competitive physical activity with rules.' },
        { answer: 'SOCCER', text: 'Sport played with a round ball and goals.' },
        { answer: 'FOOTBALL', text: 'Contact field sport with an oval ball.' },
        { answer: 'BASEBALL', text: 'Bat-and-ball game with innings.' },
        { answer: 'SOFTBALL', text: 'Variant of baseball with a larger ball.' },
        { answer: 'BASKETBALL', text: 'Court sport where teams shoot into a hoop.' },
        { answer: 'VOLLEYBALL', text: 'Net sport where teams volley a ball over.' },
        { answer: 'TENNIS', text: 'Racket sport played on a court.' },
        { answer: 'HOCKEY', text: 'Sport played with sticks and a puck or ball.' },
        { answer: 'GOLF', text: 'Sport aiming to sink a ball into holes.' },
        { answer: 'RUGBY', text: 'Team sport with continuous play and tackling.' },
        { answer: 'CRICKET', text: 'Bat-and-ball game popular in many countries.' },
        { answer: 'SWIMMING', text: 'Race sport through water using strokes.' },
        { answer: 'CYCLING', text: 'Sport of riding bicycles competitively.' },
        { answer: 'RUNNING', text: 'Foot race over a set distance.' },
        { answer: 'SPRINTER', text: 'Athlete specializing in short-distance speed.' },
        { answer: 'MARATHON', text: 'Long-distance race of over twenty-six miles.' },
        { answer: 'TRIATHLON', text: 'Race combining swimming, cycling, and running.' },
        { answer: 'WRESTLING', text: 'Combat sport of grappling techniques.' },
        { answer: 'BOXING', text: 'Combat sport fought with gloved punches.' },
        { answer: 'REFEREE', text: 'Official who enforces rules during play.' },
        { answer: 'COACH', text: 'Person who trains and guides athletes.' },
        { answer: 'STADIUM', text: 'Large venue for sports events.' },
        { answer: 'ARENA', text: 'Enclosed venue for games and matches.' },
        { answer: 'TOURNAMENT', text: 'Series of contests to determine a winner.' },
        { answer: 'PLAYOFF', text: 'Postseason elimination stage.' },
        { answer: 'CHAMPION', text: 'Winner of a competition.' },
        { answer: 'MEDAL', text: 'Award for sporting achievement.' },
        { answer: 'TROPHY', text: 'Physical prize for victory.' },
        { answer: 'SCORE', text: 'Number of points earned in a game.' },
      ],
      technology: [
        { answer: 'COMPUTER', text: 'Electronic machine that processes data.' },
        { answer: 'LAPTOP', text: 'Portable personal computer.' },
        { answer: 'DESKTOP', text: 'Stationary personal computer.' },
        { answer: 'KEYBOARD', text: 'Input device with letter and number keys.' },
        { answer: 'MONITOR', text: 'Screen used to display computer output.' },
        { answer: 'MOUSE', text: 'Pointing device for cursor control.' },
        { answer: 'PRINTER', text: 'Device that produces paper output.' },
        { answer: 'ROUTER', text: 'Network device that directs traffic.' },
        { answer: 'SERVER', text: 'Computer that provides services to clients.' },
        { answer: 'CLIENT', text: 'Device or app requesting network services.' },
        { answer: 'DATABASE', text: 'Structured collection of stored data.' },
        { answer: 'BACKEND', text: 'Server-side part of an application.' },
        { answer: 'FRONTEND', text: 'User-facing part of an application.' },
        { answer: 'BROWSER', text: 'Application used to access web pages.' },
        { answer: 'WEBSITE', text: 'Collection of related pages on the web.' },
        { answer: 'NETWORK', text: 'Connected system of devices.' },
        { answer: 'WIRELESS', text: 'Communication without physical cables.' },
        { answer: 'BLUETOOTH', text: 'Short-range wireless communication standard.' },
        { answer: 'ENCRYPTION', text: 'Process of encoding data for security.' },
        { answer: 'FIREWALL', text: 'Security system that filters network traffic.' },
        { answer: 'PASSWORD', text: 'Secret string used for authentication.' },
        { answer: 'SOFTWARE', text: 'Programs and operating information for a device.' },
        { answer: 'HARDWARE', text: 'Physical components of a computer system.' },
        { answer: 'ALGORITHM', text: 'Step-by-step method for solving a problem.' },
        { answer: 'CODING', text: 'Writing instructions in a programming language.' },
        { answer: 'DEBUGGING', text: 'Finding and fixing defects in code.' },
        { answer: 'COMPILER', text: 'Program that translates source code.' },
        { answer: 'TERMINAL', text: 'Text interface for command execution.' },
        { answer: 'CLOUD', text: 'Remote computing resources delivered online.' },
        { answer: 'GITHUB', text: 'Platform for hosting and collaborating on code.' },
      ],
      history: [
        { answer: 'HISTORY', text: 'Study of past events and societies.' },
        { answer: 'ANCIENT', text: 'Very old, especially from early civilizations.' },
        { answer: 'MEDIEVAL', text: 'Related to the Middle Ages.' },
        { answer: 'EMPIRE', text: 'Large political unit with central rule.' },
        { answer: 'DYNASTY', text: 'Line of hereditary rulers.' },
        { answer: 'PHARAOH', text: 'Title of an ancient Egyptian ruler.' },
        { answer: 'PYRAMID', text: 'Monumental structure associated with ancient Egypt.' },
        { answer: 'ROMAN', text: 'Related to ancient Rome.' },
        { answer: 'GREEK', text: 'Related to ancient Greece.' },
        { answer: 'SPARTA', text: 'Ancient Greek city-state known for warriors.' },
        { answer: 'ATHENS', text: 'Ancient city-state known for philosophy and democracy.' },
        { answer: 'VIKING', text: 'Seafaring Norse raider and trader.' },
        { answer: 'CASTLE', text: 'Fortified residence of medieval rulers.' },
        { answer: 'KNIGHT', text: 'Mounted warrior in medieval Europe.' },
        { answer: 'MONARCH', text: 'Sole and hereditary head of state.' },
        { answer: 'REVOLUTION', text: 'Major political or social upheaval.' },
        { answer: 'TREATY', text: 'Formal agreement between states.' },
        { answer: 'COLONY', text: 'Territory under control of another country.' },
        { answer: 'RENAISSANCE', text: 'Period of cultural rebirth in Europe.' },
        { answer: 'INDUSTRIAL', text: 'Related to machine-driven manufacturing growth.' },
        { answer: 'ARCHAEOLOGY', text: 'Study of human history through material remains.' },
        { answer: 'ARTIFACT', text: 'Object made by humans with historical value.' },
        { answer: 'CHRONICLE', text: 'Historical account arranged by time.' },
        { answer: 'CIVILIZATION', text: 'Advanced society with organized institutions.' },
        { answer: 'CONQUEST', text: 'Taking control of territory by force.' },
        { answer: 'EXPEDITION', text: 'Journey undertaken for discovery or research.' },
        { answer: 'ARCHIVE', text: 'Collection of historical documents and records.' },
        { answer: 'SCHOLAR', text: 'Person devoted to study and learning.' },
        { answer: 'MUSEUM', text: 'Institution preserving and displaying history.' },
        { answer: 'TIMELINE', text: 'Chronological representation of events.' },
      ],
    };

    const TOPIC_ALIASES: Record<string, string> = {
      food: 'food',
      cooking: 'food',
      kitchen: 'food',
      cuisine: 'food',
      astronomy: 'space',
      space: 'space',
      scifi: 'space',
      cosmic: 'space',
      ocean: 'ocean',
      marine: 'ocean',
      sea: 'ocean',
      aquatic: 'ocean',
      sports: 'sports',
      athletic: 'sports',
      athletics: 'sports',
      technology: 'technology',
      tech: 'technology',
      computer: 'technology',
      coding: 'technology',
      history: 'history',
      ancient: 'history',
      medieval: 'history',
      civilization: 'history',
    };

    const normalizeTopicText = (topic: string): string => {
      return topic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const resolveTopicKey = (topic: string): string | null => {
      const normalized = normalizeTopicText(topic);
      if (!normalized) return null;

      if (TOPIC_LABELS[normalized]) {
        return normalized;
      }

      if (TOPIC_ALIASES[normalized]) {
        return TOPIC_ALIASES[normalized];
      }

      for (const [alias, key] of Object.entries(TOPIC_ALIASES)) {
        if (normalized.includes(alias)) {
          return key;
        }
      }

      return null;
    };

    const buildTopicSeedEntries = (topic: string, requestedCount: number): {
      topicKey: string;
      entries: SeedEntry[];
    } | null => {
      const topicKey = resolveTopicKey(topic);
      if (!topicKey) return null;

      const pool = TOPIC_SEED_BANK[topicKey] ?? [];
      if (pool.length === 0) return null;

      const uniqueByAnswer = new Map<string, SeedEntry>();
      for (const entry of pool) {
        if (!uniqueByAnswer.has(entry.answer)) {
          uniqueByAnswer.set(entry.answer, entry);
        }
      }

      const uniquePool = Array.from(uniqueByAnswer.values());
      const maxCount = Math.min(80, uniquePool.length);
      const minCount = Math.min(12, maxCount);
      const count = clampInt(requestedCount, minCount, maxCount);

      const shuffled = <T,>(items: T[]): T[] => {
        const out = [...items];
        for (let i = out.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = out[i];
          out[i] = out[j];
          out[j] = temp;
        }
        return out;
      };

      const buckets = new Map<number, SeedEntry[]>();
      for (const entry of uniquePool) {
        const bucket = buckets.get(entry.answer.length) ?? [];
        bucket.push(entry);
        buckets.set(entry.answer.length, bucket);
      }

      for (const [length, bucket] of buckets.entries()) {
        buckets.set(length, shuffled(bucket));
      }

      const lengths = shuffled(Array.from(buckets.keys()));
      const entries: SeedEntry[] = [];

      // Ensure broad slot-length coverage first, then favor shorter/mid words.
      for (const length of lengths) {
        const next = buckets.get(length)?.pop();
        if (!next) continue;
        entries.push(next);
        if (entries.length >= count) break;
      }

      const weightedLengths: number[] = [];
      for (const length of lengths) {
        const weight = length <= 4 ? 6 : length <= 6 ? 4 : length <= 8 ? 2 : 1;
        for (let i = 0; i < weight; i += 1) {
          weightedLengths.push(length);
        }
      }

      while (entries.length < count) {
        const availableWeighted = weightedLengths.filter(
          (length) => (buckets.get(length)?.length ?? 0) > 0
        );

        if (availableWeighted.length > 0) {
          const pickedLength = availableWeighted[Math.floor(Math.random() * availableWeighted.length)];
          const picked = buckets.get(pickedLength)?.pop();
          if (picked) {
            entries.push(picked);
            continue;
          }
        }

        const fallbackLength = lengths.find((length) => (buckets.get(length)?.length ?? 0) > 0);
        if (fallbackLength == null) {
          break;
        }

        const fallback = buckets.get(fallbackLength)?.pop();
        if (!fallback) {
          break;
        }

        entries.push(fallback);
      }

      return {
        topicKey,
        entries,
      };
    };

    const cluesRoot = (puzzleData.clues && typeof puzzleData.clues === 'object')
      ? (puzzleData.clues as Record<string, unknown>)
      : {};
    const rawAcross = toClueList(cluesRoot.across);
    const rawDown = toClueList(cluesRoot.down);

    const storedLayout = Array.isArray(puzzleData._crosswordLayout)
      ? (puzzleData._crosswordLayout as unknown[])
          .map((row) => asString(row, ''))
          .filter((row) => row.length > 0)
      : [];

    const legacyLayout = parseLegacyGridText(asString(puzzleData._autoGrid, ''));
    const baseLayout =
      storedLayout.length > 0
        ? storedLayout
        : legacyLayout.length > 0
          ? legacyLayout
          : buildLayoutFromClues(rawAcross, rawDown, asNumber(puzzleData.rows, 15), asNumber(puzzleData.cols, 15));

    const inferredRows = baseLayout.length > 0 ? baseLayout.length : 15;
    const inferredCols = baseLayout[0]?.length ?? inferredRows;

    const rows = clampInt(
      Math.trunc(asNumber(puzzleData._crosswordRows, asNumber(puzzleData.rows, inferredRows))),
      MIN_GRID,
      MAX_GRID
    );
    const cols = clampInt(
      Math.trunc(asNumber(puzzleData._crosswordCols, asNumber(puzzleData.cols, inferredCols))),
      MIN_GRID,
      MAX_GRID
    );

    const layout = normalizeLayout(baseLayout, rows, cols);
    const gridRows = layout.length;
    const gridCols = layout[0]?.length ?? 0;
    const seedRaw = asString(puzzleData._crosswordSeedRaw, '');
    const topicRaw = asString(puzzleData._crosswordTopic, '');
    const topicSeedCountInput = asNumberOrEmpty(puzzleData._crosswordTopicWordCount);
    const topicSeedCount = clampInt(
      Math.trunc(asNumber(puzzleData._crosswordTopicWordCount, 36)),
      12,
      80
    );
    const generationMessage = asString(puzzleData._crosswordGenerationMessage, '');
    const generationError = asString(puzzleData._crosswordGenerationError, '');
    const supportedTopicLabels = Object.values(TOPIC_LABELS).join(', ');

    const extracted = extractSlots(layout);
    const acrossEntries = mergeSlotsWithExisting(extracted.across, 'across', rawAcross);
    const downEntries = mergeSlotsWithExisting(extracted.down, 'down', rawDown);

    const persistClues = (
      nextAcross: EditorClue[],
      nextDown: EditorClue[],
      nextLayout: string[]
    ) => {
      onDataChange('clues', {
        across: nextAcross.map((entry) => ({
          number: entry.number,
          row: entry.row,
          col: entry.col,
          length: entry.length,
          answer: normalizeAnswer(entry.answer).slice(0, entry.length),
          text: entry.text,
        })),
        down: nextDown.map((entry) => ({
          number: entry.number,
          row: entry.row,
          col: entry.col,
          length: entry.length,
          answer: normalizeAnswer(entry.answer).slice(0, entry.length),
          text: entry.text,
        })),
      });

      const nextRows = nextLayout.length;
      const nextCols = nextLayout[0]?.length ?? 0;
      const ratio = computeBlackSquareRatio(nextLayout);

      onDataChange('allowUncheckedCells', true);
      onDataChange('rows', nextRows);
      onDataChange('cols', nextCols);
      onDataChange('blackSquareRatio', Number(ratio.toFixed(4)));
    };

    const applyLayout = (nextLayoutRaw: string[]) => {
      const nextRows = clampInt(nextLayoutRaw.length || gridRows, MIN_GRID, MAX_GRID);
      const nextCols = clampInt(nextLayoutRaw[0]?.length || gridCols, MIN_GRID, MAX_GRID);
      const nextLayout = normalizeLayout(nextLayoutRaw, nextRows, nextCols);

      const nextSlots = extractSlots(nextLayout);
      const nextAcross = mergeSlotsWithExisting(nextSlots.across, 'across', acrossEntries);
      const nextDown = mergeSlotsWithExisting(nextSlots.down, 'down', downEntries);

      onDataChange('_crosswordLayout', nextLayout);
      onDataChange('_crosswordRows', nextRows);
      onDataChange('_crosswordCols', nextCols);

      persistClues(nextAcross, nextDown, nextLayout);
    };

    const resizeGrid = (nextRowsInput: number, nextColsInput: number) => {
      const nextRows = clampInt(nextRowsInput, MIN_GRID, MAX_GRID);
      const nextCols = clampInt(nextColsInput, MIN_GRID, MAX_GRID);
      const resized = normalizeLayout(layout, nextRows, nextCols);
      applyLayout(resized);
    };

    const toggleCell = (row: number, col: number) => {
      const nextLayout = layout.map((line, rowIndex) => {
        if (rowIndex !== row) return line;
        const chars = line.split('');
        chars[col] = chars[col] === '#' ? '.' : '#';
        return chars.join('');
      });
      applyLayout(nextLayout);
    };

    const entryKey = (entry: EditorClue): string => {
      return `${entry.direction}:${entry.number}:${entry.row}:${entry.col}`;
    };

    const updateEntry = (
      direction: 'across' | 'down',
      target: EditorClue,
      field: 'answer' | 'text',
      value: string
    ) => {
      const targetKey = entryKey(target);

      const nextAcross = acrossEntries.map((entry) => {
        if (direction !== 'across' || entryKey(entry) !== targetKey) return entry;
        if (field === 'answer') {
          return {
            ...entry,
            answer: normalizeAnswer(value).slice(0, entry.length),
          };
        }
        return { ...entry, text: value };
      });

      const nextDown = downEntries.map((entry) => {
        if (direction !== 'down' || entryKey(entry) !== targetKey) return entry;
        if (field === 'answer') {
          return {
            ...entry,
            answer: normalizeAnswer(value).slice(0, entry.length),
          };
        }
        return { ...entry, text: value };
      });

      persistClues(nextAcross, nextDown, layout);
    };

    const autoGenerateFromSeedEntries = (
      providedSeedEntries?: SeedEntry[] | unknown,
      options?: CrosswordGenerationOptions
    ): boolean => {
      const seedEntries = Array.isArray(providedSeedEntries)
        ? (providedSeedEntries as SeedEntry[])
        : parseSeedEntries(seedRaw);
      if (seedEntries.length < 4) {
        onDataChange('_crosswordGenerationError', 'Enter at least 4 unique ANSWER | clue lines (answers must be 3+ letters).');
        onDataChange('_crosswordGenerationMessage', '');
        return false;
      }

      const fillPoolByAnswer = new Map<string, SeedEntry>();
      for (const entry of seedEntries) {
        if (entry.answer.length < 3 || !entry.text.trim()) continue;
        if (!fillPoolByAnswer.has(entry.answer)) {
          fillPoolByAnswer.set(entry.answer, entry);
        }
      }

      const additionalPoolEntries = Array.isArray(options?.fillPoolEntries)
        ? options.fillPoolEntries
        : [];

      for (const entry of additionalPoolEntries) {
        if (entry.answer.length < 3 || !entry.text.trim()) continue;
        if (!fillPoolByAnswer.has(entry.answer)) {
          fillPoolByAnswer.set(entry.answer, entry);
        }
      }

      const fillPoolEntries = Array.from(fillPoolByAnswer.values());
      const longestAnswer = fillPoolEntries.reduce((max, entry) => Math.max(max, entry.answer.length), 3);
      const requestedRows = clampInt(gridRows, MIN_GRID, MAX_GRID);
      const requestedCols = clampInt(gridCols, MIN_GRID, MAX_GRID);
      const preferredSide = clampInt(
        Math.max(requestedRows, requestedCols, longestAnswer),
        MIN_GRID,
        MAX_GRID
      );

      const generation = generateCrosswordFromSeedEntries({
        seedEntries,
        fillPoolEntries,
        gridRows: requestedRows,
        gridCols: requestedCols,
        minGrid: Math.min(requestedRows, requestedCols),
        maxGrid: Math.max(requestedRows, requestedCols),
        preferredSide,
        maxLayoutAttemptsPerSide: seedEntries.length >= 30 ? 180 : 120,
        maxDurationMs: preferredSide >= 18 ? 7000 : 5000,
      });

      if (!generation) {
        onDataChange('_crosswordGenerationError', 'Generation could not produce a proper connected crossword. Add more short and mid-length intersectable words, or try another topic.');
        onDataChange('_crosswordGenerationMessage', '');
        onDataChange('_crosswordUnplacedWords', seedEntries.map((entry) => entry.answer));
        return false;
      }

      const totalGeneratedEntries = generation.generatedAcross.length + generation.generatedDown.length;
      const totalCells = generation.generatedRows * generation.generatedCols;
      const blackRatio = totalCells > 0
        ? (totalCells - generation.whiteCellCount) / totalCells
        : 0;

      onDataChange('_crosswordLayout', generation.generatedLayout);
      onDataChange('_crosswordRows', generation.generatedRows);
      onDataChange('_crosswordCols', generation.generatedCols);
      onDataChange('_crosswordGenerationError', '');
      onDataChange(
        '_crosswordGenerationMessage',
        `Generated ${totalGeneratedEntries} entries on ${generation.generatedRows}x${generation.generatedCols}. Black ratio: ${blackRatio.toFixed(3)}. Seed words used: ${generation.usedSeedCount}/${seedEntries.length}. Unplaced seeds: ${generation.unplacedSeedAnswers.length}. Strategy: ${generation.strategy}.`
      );
      onDataChange('_crosswordUnplacedWords', generation.unplacedSeedAnswers);

      persistClues(generation.generatedAcross, generation.generatedDown, generation.generatedLayout);
      return true;
    };

    const setTopicSeedRaw = (entries: SeedEntry[]) => {
      const nextSeedRaw = entries
        .map((entry) => `${entry.answer} | ${entry.text}`)
        .join('\n');
      onDataChange('_crosswordSeedRaw', nextSeedRaw);
    };

    const fetchRemoteTopicEntries = async (topic: string, requestedCount: number): Promise<{
      entries: SeedEntry[];
      sources: string[];
    }> => {
      const response = await fetch('/api/admin/crossword-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: requestedCount }),
      });

      const payload = await response.json().catch(() => ({})) as {
        error?: unknown;
        entries?: unknown;
        sources?: unknown;
      };

      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Topic lookup failed.');
      }

      const entries = Array.isArray(payload.entries)
        ? payload.entries
            .map((entry) => {
              const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
              return {
                answer: normalizeAnswer(record.answer),
                text: asString(record.text, '').trim(),
              };
            })
            .filter((entry) => entry.answer.length >= 3 && entry.text.length > 0)
        : [];

      const sources = Array.isArray(payload.sources)
        ? payload.sources.map((source) => String(source ?? '').trim()).filter(Boolean)
        : [];

      return { entries, sources };
    };

    const generateFromRemoteTopic = async (): Promise<boolean> => {
      const topic = topicRaw.trim();
      const normalizedTopic = normalizeTopicText(topic);
      const isRandomRequest = topic.length === 0 || ['any', 'anything', 'general', 'mixed', 'random', 'surprise'].includes(normalizedTopic);
      const lookupLabel = isRandomRequest ? 'a random set' : `"${topic}"`;

      onDataChange('_crosswordGenerationError', '');
      onDataChange(
        '_crosswordGenerationMessage',
        isRandomRequest
          ? 'Searching public word and clue sources for a random set...'
          : `Searching public word and knowledge sources for "${topic}"...`
      );

      try {
        const requestedCount = clampInt(topicSeedCount, 12, 80);
        const remote = await fetchRemoteTopicEntries(topic, requestedCount);
        if (remote.entries.length < 4) {
          onDataChange('_crosswordGenerationError', `Could not find enough crossword-friendly words for ${lookupLabel}.`);
          onDataChange('_crosswordGenerationMessage', '');
          return false;
        }

        const sourceLabel = remote.sources.length > 0
          ? remote.sources.join(' + ')
          : 'public sources';

        setTopicSeedRaw(remote.entries);
        onDataChange('_crosswordGenerationError', '');
        onDataChange(
          '_crosswordGenerationMessage',
          `Pulled ${remote.entries.length} words and clues for ${lookupLabel} from ${sourceLabel}. Generating crossword...`
        );

        const success = autoGenerateFromSeedEntries(remote.entries, {
          fillPoolEntries: remote.entries,
        });
        if (success) {
          return true;
        }

        onDataChange(
          '_crosswordGenerationError',
          `Pulled words for ${lookupLabel}, but they could not fit into the current grid. Try a larger grid or a higher word count.`
        );
        return false;
      } catch (error) {
        onDataChange(
          '_crosswordGenerationError',
          error instanceof Error ? error.message : 'Topic lookup failed.'
        );
        onDataChange('_crosswordGenerationMessage', '');
        return false;
      }
    };

    const autoGenerateFromTopic = async () => {
      const topicKey = resolveTopicKey(topicRaw);
      if (!topicKey) {
        await generateFromRemoteTopic();
        return;
      }

      const poolSize = TOPIC_SEED_BANK[topicKey]?.length ?? 0;
      const countsToTry = Array.from(
        new Set([
          clampInt(topicSeedCount, 12, Math.max(12, poolSize)),
          clampInt(topicSeedCount + 8, 12, Math.max(12, poolSize)),
          clampInt(topicSeedCount + 16, 12, Math.max(12, poolSize)),
          Math.max(12, poolSize),
        ])
      ).sort((a, b) => a - b);

      for (const count of countsToTry) {
        const generated = buildTopicSeedEntries(topicRaw, count);
        if (!generated) continue;

        setTopicSeedRaw(generated.entries);
        onDataChange('_crosswordGenerationError', '');
        onDataChange(
          '_crosswordGenerationMessage',
          `Built ${generated.entries.length} topic seeds for ${TOPIC_LABELS[generated.topicKey]}. Generating crossword...`
        );

        const success = autoGenerateFromSeedEntries(generated.entries, {
          fillPoolEntries: TOPIC_SEED_BANK[generated.topicKey] ?? generated.entries,
        });
        if (success) {
          return;
        }
      }

      await generateFromRemoteTopic();
    };

    const clueNumberByCell = new Map<string, number>();
    for (const slot of [...extracted.across, ...extracted.down]) {
      const key = `${slot.row},${slot.col}`;
      if (!clueNumberByCell.has(key)) {
        clueNumberByCell.set(key, slot.number);
      }
    }

    const allEntries = [...acrossEntries, ...downEntries];
    const missingAnswerCount = allEntries.filter((entry) => entry.answer.length !== entry.length).length;
    const missingClueCount = allEntries.filter((entry) => !entry.text.trim()).length;
    const blackCells = layout.reduce((sum, row) => {
      return sum + row.split('').filter((cell) => cell === '#').length;
    }, 0);
    const whiteCells = gridRows * gridCols - blackCells;
    const unplacedWords = Array.isArray(puzzleData._crosswordUnplacedWords)
      ? (puzzleData._crosswordUnplacedWords as unknown[])
          .map((word) => normalizeAnswer(word))
          .filter((word) => word.length > 0)
      : [];

    const cellSize = gridCols >= 20 ? 20 : gridCols >= 15 ? 24 : 28;

    return (
      <div className="space-y-6">
        <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe' }}>
          <p className="font-bold mb-1">🧩 Grid-first crossword editor</p>
          <p>1) Design the black-square layout by clicking cells. 2) Enter answers and clues for each auto-numbered slot. 3) Save.</p>
          <p className="mt-1">All numbering and slot lengths are derived from the grid, so this scales to large boards like 20×20.</p>
        </div>

        <div className="rounded-lg p-4 space-y-3" style={{ background: 'rgba(56,145,166,0.08)', border: '1px solid rgba(56,145,166,0.3)' }}>
          <label className={labelCls}>
            Seed Words + Clues <span className="font-normal text-gray-500">(one per line: ANSWER | clue)</span>
          </label>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className={labelCls}>Topic or Random</label>
              <input
                type="text"
                value={topicRaw}
                onChange={(e) => onDataChange('_crosswordTopic', e.target.value)}
                placeholder="e.g. animals, mythology, space; blank for random"
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Topic Word Count</label>
              <input
                type="number"
                min={12}
                max={80}
                value={topicSeedCountInput}
                onChange={(e) => onDataChange('_crosswordTopicWordCount', e.target.value)}
                onBlur={() => onDataChange('_crosswordTopicWordCount', topicSeedCount)}
                className={fieldCls}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={autoGenerateFromTopic}
                className="w-full px-3 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.5)' }}
              >
                Generate From Topic
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Preset shortcuts: {supportedTopicLabels}. Leave blank or type random for mixed clues; other topics use public word and knowledge sources.
          </p>
          <textarea
            rows={6}
            value={seedRaw}
            onChange={(e) => onDataChange('_crosswordSeedRaw', e.target.value)}
            placeholder={'DREAM | Sequence of images during sleep\nINTRO | Opening section\nNITRO | High-performance fuel additive'}
            className={`${fieldCls} resize-y font-mono`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={autoGenerateFromSeedEntries}
              className="px-3 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'rgba(56,145,166,0.35)', border: '1px solid rgba(56,145,166,0.5)' }}
            >
              Generate Grid From Seed List
            </button>
            <span className="text-xs text-gray-400">
              Use any topic, leave it blank for random words+clues, or paste your own seed list.
            </span>
          </div>

          {generationError && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fecaca' }}>
              {generationError}
            </div>
          )}

          {generationMessage && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#bbf7d0' }}>
              {generationMessage}
            </div>
          )}

          {unplacedWords.length > 0 && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', color: '#fde68a' }}>
              Unplaced seed words: {unplacedWords.join(', ')}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Rows</label>
            <input
              type="number"
              min={MIN_GRID}
              max={MAX_GRID}
              value={gridRows}
              onChange={(e) => resizeGrid(Number(e.target.value || gridRows), gridCols)}
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Columns</label>
            <input
              type="number"
              min={MIN_GRID}
              max={MAX_GRID}
              value={gridCols}
              onChange={(e) => resizeGrid(gridRows, Number(e.target.value || gridCols))}
              className={fieldCls}
            />
          </div>
          <div className="lg:col-span-2 flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => resizeGrid(13, 13)}
              className="px-3 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)' }}
            >
              13×13
            </button>
            <button
              type="button"
              onClick={() => resizeGrid(15, 15)}
              className="px-3 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)' }}
            >
              15×15
            </button>
            <button
              type="button"
              onClick={() => resizeGrid(20, 20)}
              className="px-3 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)' }}
            >
              20×20
            </button>
            <button
              type="button"
              onClick={() => applyLayout(createBlankLayout(gridRows, gridCols))}
              className="px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(148,163,184,0.2)', border: '1px solid rgba(148,163,184,0.35)', color: '#e2e8f0' }}
            >
              Clear blacks
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Grid layout (click to toggle black squares)</label>
          <div className="overflow-x-auto">
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
                gap: 1,
                background: '#111827',
                padding: 2,
                borderRadius: 8,
                border: '1px solid rgba(99,102,241,0.35)',
              }}
            >
              {layout.map((line, row) =>
                line.split('').map((cell, col) => {
                  const isBlack = cell === '#';
                  const clueNum = clueNumberByCell.get(`${row},${col}`);
                  return (
                    <button
                      type="button"
                      key={`${row}-${col}`}
                      onClick={() => toggleCell(row, col)}
                      title={`Row ${row + 1}, Col ${col + 1} — ${isBlack ? 'black' : 'white'}`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: 3,
                        border: isBlack ? '1px solid #1f2937' : '1px solid rgba(99,102,241,0.45)',
                        background: isBlack ? '#020617' : 'rgba(99,102,241,0.12)',
                        position: 'relative',
                      }}
                    >
                      {!isBlack && clueNum !== undefined && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 1,
                            left: 2,
                            fontSize: Math.max(7, cellSize * 0.26),
                            lineHeight: 1,
                            color: '#94a3b8',
                            fontWeight: 700,
                          }}
                        >
                          {clueNum}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {gridRows}×{gridCols} · {whiteCells} white · {blackCells} black · black ratio {computeBlackSquareRatio(layout).toFixed(3)}
          </p>
        </div>

        <div className="rounded-lg p-3 text-xs" style={{ background: missingAnswerCount || missingClueCount ? 'rgba(251,191,36,0.1)' : 'rgba(34,197,94,0.1)', border: missingAnswerCount || missingClueCount ? '1px solid rgba(251,191,36,0.35)' : '1px solid rgba(34,197,94,0.35)', color: missingAnswerCount || missingClueCount ? '#fcd34d' : '#86efac' }}>
          <p className="font-bold mb-1">Slot summary</p>
          <p>{acrossEntries.length} across · {downEntries.length} down · {allEntries.length} total clues</p>
          <p>{missingAnswerCount} answers incomplete · {missingClueCount} clues missing text</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.55)' }}>
            <label className={labelCls}>Across entries ({acrossEntries.length})</label>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {acrossEntries.length === 0 && (
                <p className="text-xs text-gray-500">No across entries yet. Toggle black squares to create slots.</p>
              )}
              {acrossEntries.map((entry) => (
                <div key={entryKey(entry)} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(100,116,139,0.45)' }}>
                  <p className="text-xs text-gray-400 font-semibold">
                    #{entry.number} · row {entry.row + 1}, col {entry.col + 1} · {entry.length} letters
                  </p>
                  <input
                    type="text"
                    maxLength={entry.length}
                    value={entry.answer}
                    onChange={(e) => updateEntry('across', entry, 'answer', e.target.value)}
                    placeholder={`${entry.length}-letter answer`}
                    className={`${fieldCls} font-mono uppercase tracking-wider`}
                  />
                  <input
                    type="text"
                    value={entry.text}
                    onChange={(e) => updateEntry('across', entry, 'text', e.target.value)}
                    placeholder="Across clue text"
                    className={fieldCls}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.55)' }}>
            <label className={labelCls}>Down entries ({downEntries.length})</label>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {downEntries.length === 0 && (
                <p className="text-xs text-gray-500">No down entries yet. Toggle black squares to create slots.</p>
              )}
              {downEntries.map((entry) => (
                <div key={entryKey(entry)} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(100,116,139,0.45)' }}>
                  <p className="text-xs text-gray-400 font-semibold">
                    #{entry.number} · row {entry.row + 1}, col {entry.col + 1} · {entry.length} letters
                  </p>
                  <input
                    type="text"
                    maxLength={entry.length}
                    value={entry.answer}
                    onChange={(e) => updateEntry('down', entry, 'answer', e.target.value)}
                    placeholder={`${entry.length}-letter answer`}
                    className={`${fieldCls} font-mono uppercase tracking-wider`}
                  />
                  <input
                    type="text"
                    value={entry.text}
                    onChange={(e) => updateEntry('down', entry, 'text', e.target.value)}
                    placeholder="Down clue text"
                    className={fieldCls}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const typeSpecificRenders: Record<string, () => JSX.Element> = {
    cipher: renderCipherFields,
    text_extraction: renderTextExtractionFields,
    coordinates: renderCoordinatesFields,
    image_analysis: renderImageAnalysisFields,
    audio_spectrum: renderAudioSpectrumFields,
    morse_code: renderMorseCodeFields,
    steganography: renderSteganographyFields,
    multi_step: renderMultiStepFields,
    math: renderMathFields,
    pattern: renderPatternFields,
    escape_room: renderEscapeRoomFields,
    jim_wyze_case: renderEscapeRoomFields,
    detective_case: renderDetectiveCaseFields,
    crime_rpg: renderCrimeCaseFields,
    parasite_code: renderParasiteCodeFields,
    gridlock_file: renderGridlockFileFields,
    debrief: renderDebriefFields,
    crack_safe: renderCrackSafeFields,
    word_crack: renderWordleFields,
    word_search: renderWordSearchFields,
    anagram_blitz: renderAnagramBlitzFields,
    blackout: renderBlackoutFields,
    arg: renderArgFields,
    crossword: renderCrosswordFields,
    vault: renderVaultFields,
    cipher_clash: renderCipherClashFields,
  };

  const renderer = typeSpecificRenders[puzzleType];

  // For escape-room-canvas types, do not wrap in config card or heading.
  if (puzzleType === 'escape_room' || puzzleType === 'jim_wyze_case') {
    return renderer ? renderer() : null;
  }
  return (
    <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6 space-y-4">
      <h4 className="text-lg font-bold text-white mb-4">⚙️ {puzzleType.replace(/_/g, ' ').toUpperCase()} Configuration</h4>
      {renderer ? renderer() : <p className="text-gray-400">No additional configuration for this type</p>}
    </div>
  );
}
