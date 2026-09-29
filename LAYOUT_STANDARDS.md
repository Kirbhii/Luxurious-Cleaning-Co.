# Layout Standards

This document defines the layout standards for Luxurious Cleaning Co. to ensure consistent spacing, prevent element shifting, and maintain a professional appearance across all pages.

## Core Principles

1. **Consistent Container Widths** - All pages use standardized max-width containers
2. **Fixed Top Padding** - All pages have `pt-16` (64px) to account for fixed navbar
3. **Predictable Spacing** - Section padding follows a consistent rhythm
4. **No Layout Shift** - Scrollbar always visible, box-sizing consistent

## Page Wrapper

Every page should start with:

```tsx
<div className="pt-16 min-h-screen bg-navy-950">
  {/* Page content */}
</div>
```

- `pt-16`: Matches navbar height (h-16 = 64px)
- `min-h-screen`: Ensures full viewport height
- `bg-navy-950`: Consistent background color

## Container Widths

Use the `PageContainer` component or apply these classes directly:

### Wide Container (Default)
**Usage**: Services, galleries, grids, most content pages
```tsx
<div className="max-w-7xl mx-auto px-6">
```

### Narrow Container
**Usage**: Forms, booking flow, focused content
```tsx
<div className="max-w-3xl mx-auto px-6">
```

### Standard Container
**Usage**: Text-heavy pages, articles
```tsx
<div className="max-w-5xl mx-auto px-6">
```

## Section Spacing

### Page Headers
```tsx
<section className="py-20 bg-navy-900 border-b border-gold-400/10">
  <div className="max-w-7xl mx-auto px-6">
    {/* Header content */}
  </div>
</section>
```

- Vertical padding: `py-20` (5rem / 80px)
- Background: `bg-navy-900` (slightly lighter than page background)
- Border: `border-b border-gold-400/10` (subtle separator)

### Content Sections
```tsx
<section className="py-16">
  <div className="max-w-7xl mx-auto px-6">
    {/* Section content */}
  </div>
</section>
```

- Standard vertical padding: `py-16` (4rem / 64px)
- Use `py-12` for tighter spacing
- Use `py-24` for more breathing room

### Footer/CTA Sections
```tsx
<section className="py-16 bg-navy-800 border-t border-gold-400/10">
  <div className="max-w-3xl mx-auto px-6 text-center">
    {/* CTA content */}
  </div>
</section>
```

## Navbar Specifications

```tsx
<header className="fixed top-0 left-0 right-0 z-50 bg-navy-950/97 backdrop-blur-md border-b border-gold-400/15">
  <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
    {/* Navbar content */}
  </div>
</header>
```

- Height: `h-16` (64px) - **Must match page `pt-16` padding**
- Position: `fixed top-0` with `z-50` to stay above content
- Backdrop: `backdrop-blur-md` for glass effect
- Container: `max-w-7xl mx-auto px-6` (matches wide container)

## Common Patterns

### Service/Feature Cards Grid
```tsx
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => (
    <div key={item.id} className="bg-navy-800 border border-gold-400/10 rounded-xl p-6">
      {/* Card content */}
    </div>
  ))}
</div>
```

### Two-Column Layout
```tsx
<div className="grid lg:grid-cols-2 gap-16 items-center">
  <div>{/* Left column */}</div>
  <div>{/* Right column */}</div>
</div>
```

### Text with Eyebrow + Headline
```tsx
<div>
  <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">
    Eyebrow Text
  </div>
  <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">
    Main Headline
  </h1>
  <p className="text-cream-300 text-lg max-w-xl leading-relaxed">
    Description text
  </p>
</div>
```

## CSS Utility Classes

Pre-defined utilities in `index.css`:

- `.container-narrow` - max-w-768px with padding
- `.container-standard` - max-w-1024px with padding
- `.container-wide` - max-w-1280px with padding
- `.page-wrapper` - Consistent page shell
- `.page-header` - Standard header section
- `.section-spacing-sm` - py-12
- `.section-spacing-md` - py-16
- `.section-spacing-lg` - py-20

## Layout Stabilization Features

The following CSS rules prevent layout shift:

1. **Always-visible scrollbar** - `html { overflow-y: scroll; }`
2. **Consistent box-sizing** - All elements use `border-box`
3. **Responsive images** - `max-width: 100%; height: auto;`
4. **Fixed navbar height** - Matches page top padding exactly

## Checklist for New Pages

- [ ] Page wrapper: `pt-16 min-h-screen bg-navy-950`
- [ ] Header section: `py-20 bg-navy-900 border-b border-gold-400/10`
- [ ] Container: `max-w-7xl mx-auto px-6` (or appropriate width)
- [ ] Content sections: Consistent `py-16` or similar
- [ ] No inline padding/margin that breaks the grid
- [ ] TypeScript compilation passes
- [ ] Visual verification across different screen sizes

## Examples

### Standard Page Structure
```tsx
export default function MyPage() {
  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      {/* Header */}
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">
            Eyebrow
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">
            Page Title
          </h1>
          <p className="text-cream-300 text-lg max-w-xl leading-relaxed">
            Description
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          {/* Content */}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-navy-800 border-t border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          {/* Call to action */}
        </div>
      </section>
    </div>
  );
}
```

### Form Page Structure
```tsx
export default function FormPage() {
  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      {/* Compact header for forms */}
      <section className="py-12 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-2">
            Form Category
          </div>
          <h1 className="font-serif text-4xl text-cream-100">Form Title</h1>
        </div>
      </section>

      {/* Form content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Form fields */}
      </div>
    </div>
  );
}
```

## Troubleshooting Layout Shifts

If you notice elements moving when navigating between pages:

1. **Check container widths** - Ensure all pages use same max-w- class
2. **Verify padding** - All pages should have `px-6` horizontal padding
3. **Inspect navbar** - Must be `h-16` and `fixed top-0`
4. **Page padding** - Must be `pt-16` to account for navbar
5. **Scrollbar** - HTML should have `overflow-y: scroll`
6. **Responsive breakpoints** - Test at various screen sizes

## Maintenance

When adding new pages:
1. Copy structure from existing pages (Services, About, Contact)
2. Follow the checklist above
3. Test navigation between pages to ensure no shifting
4. Verify on mobile, tablet, and desktop viewports
