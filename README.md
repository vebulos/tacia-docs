# TaciaDocs Documentation Portal

[![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

Modern (documentation) platform for any project, providing an intuitive interface for browsing and searching any markdown files organized in folders.

## ✨ Features

- 🚀 Fast and responsive user interface
- 📱 Mobile-first responsive design
- 🌓 Light/Dark theme support
- 🔍 Real-time search functionality
- 📚 Hierarchical documentation navigation
- 📝 Markdown support with syntax highlighting
- 🔗 Automatic internal link generation
- 🌍 Internationalization (i18n) support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Angular CLI 19+
- (For Java backend) Java 17+ and Maven 3.8+

### Backend Options

This frontend can work with either of these backend implementations:

1. **Node.js Backend** (Recommended for development)
   ```bash
   git clone https://github.com/vebulos/tacia-docs-backend-js.git backend-js
   cd backend-js
   npm install
   npm run dev
   ```

2. **Java Backend** (Recommended for production)
   ```bash
   git clone https://github.com/vebulos/tacia-docs-backend-java.git backend-java
   cd backend-java
   mvn spring-boot:run
   ```

### Frontend Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/vebulos/tacia-docs.git
   cd tacia-docs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   ng serve
   ```

The application will be available at `http://localhost:4200/`

## 🛠 Development

### Environment Variables

Adjust `environment.ts` (dev) in `src/environments/` with the appropriate configuration based on your backend choice:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4201/api',
  
  // For Java backend (default port 8080)
  // apiUrl: 'http://localhost:8080/api',
  
  defaultLanguage: 'en',
  availableLanguages: ['en', 'fr']
};
```

### Useful Commands

```bash
# Run unit tests
ng test

# Build for production
ng build --configuration production
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/           # Core services, interceptors, guards
│   │   ├── features/       # Feature modules
│   │   │   ├── home/       # Home page
│   │   │   ├── docs/       # Documentation viewer
│   │   │   └── search/     # Search functionality
│   │   ├── shared/         # Shared components
│   │   └── app.component.* # Root component
│   ├── assets/             # Static assets
│   └── environments/       # Environment configurations
├── scripts/               # Utility scripts
└── server/                # Development server
```

## 🚀 Deployment

### Production Build

1. Update production configuration in `environment.prod.ts`
2. Build the application:
   ```bash
   ng build --configuration production
   ```
3. Production files will be available in the `dist/` directory

### Docker Deployment

```bash
docker build -t tacia-docs-frontend .
docker run -p 80:80 tacia-docs-frontend
```

## 🤝 Contributing

1. Create your feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. Commit your changes:
   ```bash
   git commit -m 'feat: add amazing feature'
   ```
3. Push to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
4. Open a Pull Request

## 📚 Resources

- [Angular Documentation](https://angular.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Angular Style Guide](https://angular.io/guide/styleguide)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Made with ❤️ by the TaciaNet Team
</div>
