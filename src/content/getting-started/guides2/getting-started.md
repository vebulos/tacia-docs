---
title: Getting Started with Our Framework
categories: [guides]
tags: [tutorial, beginner]
difficulty: beginner
---

# Getting Started

This guide will walk you through creating your first application with our framework.

## Prerequisites

- Basic knowledge of JavaScript/TypeScript
- Node.js 16+ installed
- npm or yarn

## Creating a New Project

1. Install the CLI globally:
   ```bash
   npm install -g @yourframework/cli
   ```

2. Create a new project:
   ```bash
   yourframework new my-app
   cd my-app
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
my-app/
├── src/
│   ├── components/  # Your components
│   ├── pages/       # Application pages
│   ├── styles/      # Global styles
│   └── main.js      # Application entry point
├── public/         # Static files
└── package.json    # Project configuration
```

## Your First Component

Create a new component in `src/components/HelloWorld.vue`:

```vue
<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <button @click="count++">Count is: {{ count }}</button>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    msg: String
  },
  data() {
    return {
      count: 0
    }
  }
}
</script>

<style scoped>
.hello {
  text-align: center;
  margin-top: 2rem;
}
button {
  padding: 0.5rem 1rem;
  background: #42b983;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}
</style>
```

## Next Steps

- [Learn about routing](./routing)
- [State management](./state-management)
- [API integration](./api)

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   Solution: Stop the other process or use a different port:
   ```bash
   PORT=3001 npm run dev
   ```

2. **Missing dependencies**
   ```bash
   Error: Cannot find module 'xyz'
   ```
   Solution: Run `npm install` to install all dependencies.
