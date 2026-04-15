# Frontend Minimal Style System

## 1. Purpose

This document defines the default visual language for the client-facing frontend of YaoLight Workshop.

Target outcome:

- Minimal but not empty
- Soft and comfortable
- Calm black/white/neutral palette
- Low AI flavor
- Product-like instead of showcase-like
- High whitespace discipline

This document should be treated as the default UI contract for future frontend work unless a page has a strong business reason to diverge.

## 2. Core Style Keywords

Primary keywords:

- quiet
- soft
- restrained
- spacious
- editorial
- product-first
- human-centered

Secondary keywords:

- rounded
- warm-neutral
- light-glass
- low-contrast layering
- subtle depth

Must avoid:

- loud gradients
- sci-fi glow
- dashboard overload
- too many metrics
- heavy AI branding language
- strong neon effects
- overly dense cards
- crowded headers

## 3. Experience Principles

### 3.1 Content Priority

Each page should answer this order:

1. What is the main action here?
2. What is the minimum context needed to act?
3. What should remain visible after the user starts?

Rule:

- Do not lead with explanation blocks if the main action can be understood directly.
- Prefer one main action area and one secondary content area.

### 3.2 Visual Density

Rule:

- Show fewer things.
- Make each visible thing breathe more.

Targets:

- Prefer 1 primary region above the fold
- Prefer 1-2 supporting regions below the fold
- Avoid 3+ competing modules in the first viewport

### 3.3 AI Expression

Rule:

- The product can be AI-powered, but the UI should not constantly announce it.

Preferred wording:

- “开始”
- “新建项目”
- “最近项目”
- “从这里继续”

Avoid wording like:

- “AI 驾驶舱”
- “智能创作中枢”
- “超级助手工作台”
- “下一代 AI 生产平台”

## 4. Color System

Only use black, white, and neutral warm grays as the default language.

### 4.1 Base Palette

Light mode:

- Page background: `#f7f5f1`
- Primary surface: `rgba(255, 255, 255, 0.72)` to `#ffffff`
- Secondary surface: `rgba(255, 255, 255, 0.52)`
- Border soft: `rgba(0, 0, 0, 0.06)`
- Border stronger: `rgba(0, 0, 0, 0.10)`
- Text primary: `#111111`
- Text secondary: `rgba(17, 17, 17, 0.72)`
- Text tertiary: `rgba(17, 17, 17, 0.48)`

Dark mode:

- Page background: `#171717`
- Primary surface: `rgba(255, 255, 255, 0.02)` to `rgba(255, 255, 255, 0.05)`
- Secondary surface: `rgba(255, 255, 255, 0.03)`
- Border soft: `rgba(255, 255, 255, 0.06)`
- Border stronger: `rgba(255, 255, 255, 0.10)`
- Text primary: `#f2f2f2`
- Text secondary: `rgba(255, 255, 255, 0.72)`
- Text tertiary: `rgba(255, 255, 255, 0.48)`

### 4.2 Color Rules

- Do not introduce brand colors by default.
- Do not use pure black on large surfaces unless balanced by softness in border, spacing, or transparency.
- If a colored state is necessary, keep it local and low frequency.
- Status color should not dominate the page.

## 5. Typography System

### 5.1 Typography Mood

The system should feel calm and editorial, not technical or startup-loud.

### 5.2 Recommended Usage

Primary display/headline:

- Serif allowed for homepage hero only
- Weight: 400-500
- Large size with generous line-height

Body/UI text:

- Clean sans-serif
- Weight: 400-600
- Prefer understated labels and short copy

### 5.3 Size Guidance

- Hero title: `34px-52px`
- Section title: `22px-28px`
- Card title: `18px-22px`
- Body text: `14px-15px`
- Meta text: `12px-13px`

### 5.4 Typography Rules

- Use fewer bold weights.
- Prefer contrast through space and size, not excessive weight.
- Do not stack multiple emphasized texts in the same block.

## 6. Radius, Border, and Shadow

### 6.1 Radius

Default radius scale:

- Small interactive chip/button: `999px`
- Card radius: `24px-28px`
- Modal/dropdown radius: `20px`
- Input/composer radius: `24px-28px`

### 6.2 Border

Rule:

- Borders are soft separators, not hard frames.

Preferred:

- `1px solid rgba(0, 0, 0, 0.06)` in light mode
- `1px solid rgba(255, 255, 255, 0.06)` in dark mode

### 6.3 Shadow

Rule:

- Use low, diffuse shadow.
- No harsh layered elevation.

Preferred examples:

- `0 10px 28px rgba(0, 0, 0, 0.03)`
- `0 16px 40px rgba(0, 0, 0, 0.08)`

Avoid:

- hard drop shadows
- glowing shadows
- large black blur under every card

## 7. Layout Rules

### 7.1 Page Structure

Default page template:

1. Soft top bar
2. One centered primary action zone
3. One supporting content zone
4. Optional pagination/footer controls

### 7.2 Width Rules

- Hero/intro section max width: `720px-780px`
- Main content container max width: `1120px-1280px`
- Keep main interactive content centered

### 7.3 Spacing Rules

Preferred vertical rhythm:

- 12
- 16
- 24
- 32
- 48
- 72

Rule:

- If a section feels cramped, increase outer spacing before adding visual separators.

## 8. Header / Top Tab Rules

The top bar should feel like part of the page atmosphere, not a control console.

### 8.1 Header Style

- Sticky
- Soft translucent background
- Thin bottom border
- Light blur
- Max-width inner container

### 8.2 Header Composition

Allowed:

- brand
- 2-3 utility controls
- profile chip

Avoid:

- dense nav tabs
- strong icon buttons
- many colored badges
- command-center layouts

### 8.3 Header Controls

- Use pill or rounded controls
- Use subtle hover background only
- Do not use strong filled buttons in utility area unless necessary

## 9. Homepage Rules

### 9.1 Homepage Purpose

The homepage is an entry page, not a dashboard.

The homepage should mainly support:

- start a new thing
- find an existing thing
- continue recent work

### 9.2 Homepage Must Have

- short greeting
- one centered search/composer zone
- one primary CTA
- a few quiet quick-start chips
- a recent projects section

### 9.3 Homepage Must Not Have

- multiple metrics panels
- dense feature explanations
- many large banners
- aggressive AI slogans
- strong visual noise

## 10. Component Rules

### 10.1 Buttons

Primary button:

- Filled black in light mode
- Filled near-white in dark mode
- Pill shape
- Medium weight

Secondary button:

- Soft neutral surface
- Thin border
- No heavy shadow

### 10.2 Input / Composer

- Larger rounded container
- Minimal inner chrome
- One icon max
- One action row max

### 10.3 Cards

- Low-contrast surface
- One clear title
- One short description
- Quiet footer meta

Card content rule:

- 1 title
- 1 short body
- 1 footer line
- Max 2 utility actions visible

### 10.4 Chips

- Rounded pill
- Neutral border
- Subtle hover shift
- No bright accents by default

### 10.5 Dropdowns / Popovers / Notifications

- Same surface language as cards
- Same radius family
- Same soft border
- No sharp corners
- No heavy dark panel unless page context requires it

## 11. Copywriting Rules

### 11.1 Tone

- simple
- direct
- calm
- low-pressure

### 11.2 Copy Length

- headings should usually fit on one or two lines
- helper text should be one short sentence
- avoid over-explaining in primary regions

### 11.3 Preferred Voice

Preferred:

- “从这里开始”
- “继续最近项目”
- “还没有项目”
- “可以稍后补充描述”

Avoid:

- “赋能”
- “智能引擎”
- “创作中枢”
- “沉浸式 AI 体验”

## 12. Motion Rules

- Motion must be subtle and low frequency.
- Prefer hover lift `1px-2px`.
- Prefer opacity/background transitions under `200ms`.
- Avoid hero entrance theatrics.
- Avoid floating particles, scanning lines, or sci-fi motion.

## 13. Accessibility Rules

- Keep text/background contrast readable even within soft neutrals.
- Interactive controls must stay clearly clickable.
- Hover-only meaning is not allowed.
- Important actions must remain readable on both light and dark theme.

## 14. Implementation Checklist

Before shipping any page, verify:

- Is there exactly one clear primary action?
- Can the first screen be understood in under 3 seconds?
- Are there fewer visible modules than before?
- Does the page still feel complete after removing one non-essential block?
- Are colors still black/white/neutral by default?
- Does the page avoid obvious “AI product landing page” tropes?
- Are spacing and roundness aligned with the homepage?
- Does dark mode preserve the same softness, not just invert colors?

## 15. Default Build Rules For Future Pages

When implementing future client pages, default to:

- centered main content
- warm neutral background
- pill controls
- low-contrast cards
- minimal top explanation
- concise action-first copy
- no unnecessary stats

If uncertain between “more elements” and “more whitespace”, choose more whitespace.

If uncertain between “stronger visual identity” and “calmer readability”, choose calmer readability.

If uncertain between “AI feeling” and “timeless product feeling”, choose timeless product feeling.

## 16. Current Reference Pages

Current reference implementation:

- Homepage dashboard: [frontend/src/pages/Dashboard/index.tsx](/e:/Lichenxi/YaoLight_Workshop/frontend/src/pages/Dashboard/index.tsx)
- Homepage styles: [frontend/src/pages/Dashboard/index.module.scss](/e:/Lichenxi/YaoLight_Workshop/frontend/src/pages/Dashboard/index.module.scss)
- Shared top bar styles: [frontend/src/components/Layout/index.module.scss](/e:/Lichenxi/YaoLight_Workshop/frontend/src/components/Layout/index.module.scss)

This document is the visual baseline for future client-side refactors.
