---
title: Installation Guide
categories: [getting-started]
tags: [setup, installation]
difficulty: beginner
---

# Installation Guide

## Prerequisites

- Node.js 16 or later
- npm 8 or later
- Angular CLI

## Steps

1. Install Angular CLI globally:
   ```bash
   npm install -g @angular/cli
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   ng serve
   ```

## Troubleshooting

If you encounter any issues during installation, try the following:

- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`
