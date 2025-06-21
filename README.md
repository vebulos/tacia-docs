# TaciaNet Documentation Portal

[![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

Modern documentation portal built with Angular, providing a clean and intuitive interface for browsing and searching documentation content.

## ✨ Features

- 🚀 Fast and responsive UI built with Angular
- 📱 Mobile-friendly design
- 🌓 Light/Dark theme support
- 🔍 Full-text search functionality
- 📚 Hierarchical documentation navigation
- 📝 Markdown support with syntax highlighting
- 🔗 Automatic internal link generation

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Angular CLI 19+

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/tacianet-frontend.git
   cd tacianet-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## 🛠 Development

### Start Development Server

```bash
# Start the frontend development server
ng serve

# In a separate terminal, start the API server
cd server
node server.js --content-dir=/path/to/your/content
```

The application will be available at `http://localhost:4200/`

### Build for Production

```bash
# Build the application
ng build --configuration production

# The build artifacts will be stored in the `dist/` directory
```

## 🧰 Utilities

### Add Metadata to Markdown Files

To automatically add front matter metadata to markdown files without it:

```bash
node scripts/add-metadata.js --content-dir=/path/to/your/content
```

## 📁 Project Structure

```
frontend/
├── src/                    # Source files
│   ├── app/                # Application code
│   │   ├── core/           # Core module (singleton services, guards, etc.)
│   │   ├── features/       # Feature modules
│   │   └── shared/         # Shared module (components, directives, pipes)
│   └── assets/             # Static assets
├── server/                 # API server
└── scripts/                # Utility scripts
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🧪 Testing

### Unit Tests

Run the unit tests with Karma test runner:

```bash
ng test
```

### End-to-End Tests

Run end-to-end tests (requires a test framework to be set up):

```bash
ng e2e
```

## 📚 Additional Resources

- [Angular Documentation](https://angular.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Angular CLI Command Reference](https://angular.dev/tools/cli)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
