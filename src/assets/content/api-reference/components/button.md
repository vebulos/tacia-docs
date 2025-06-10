---
title: Button Component
categories: [api-reference, components]
tags: [ui, components, button]
difficulty: intermediate
---

# Button Component

A customizable button component with multiple variants and sizes.

## Import

```typescript
import { ButtonModule } from '@your-library/button';
```

## Usage

```html
<button 
  type="button"
  class="btn btn-primary"
  (click)="handleClick()"
>
  Click me
</button>
```

## Variants

### Primary
```html
<button class="btn btn-primary">Primary</button>
```

### Secondary
```html
<button class="btn btn-secondary">Secondary</button>
```

### Sizes

```html
<button class="btn btn-sm">Small</button>
<button class="btn">Default</button>
<button class="btn btn-lg">Large</button>
```

## Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| type | 'button' \| 'submit' | 'button' | Button type |
| disabled | boolean | false | Disable the button |
| loading | boolean | false | Show loading state |

## Events

| Event | Description |
|-------|-------------|
| click | Emitted when button is clicked |
