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
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine (Linux)

---

### Backend Setup (Manual or for Local Development)

You can use either backend implementation with this frontend:

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

---

### 🐳 Dockerized Full Stack Setup

For production or integrated testing, use Docker Compose for a fully containerized setup. You can choose between the Java or JavaScript backend, and dynamically mount your documentation content folder.

#### 1. Prepare Your Content Directory

Ensure your markdown documentation is organized in a folder (e.g. `../DATA/content`). Example structure:

```
content/
  guides/
    getting-started/
      installation.md
  api/
    reference.md
```

#### 2. Start the Application

From the `docker` directory, run:

```sh
./start-app.sh [js|java] <path_to_content_directory>
```
- `js` for the Node.js backend, `java` for the Java backend
- `<path_to_content_directory>` is the path to your documentation root (absolute or relative)

**Examples:**
```sh
./start-app.sh js ../DATA/content
./start-app.sh java ../DATA/content
```

The script will:
- Build all Docker images (frontend, backend, testpoint)
- Mount your content directory into the backend container
- Dynamically set up environment variables for backend selection
- Wait for the backend to be ready (health check)
- (Optional) You can add integration tests or frontend tests in the script

#### 3. Access the App

- Frontend: [http://localhost](http://localhost)
- API: [http://localhost/api/](http://localhost/api/)

#### 4. Stopping and Cleaning Up

To stop and remove all containers, networks, and volumes:
```sh
./clean-docker.sh
```

---

### ⚙️ Environment Variables

- `BACKEND_SERVICE`: (set automatically) Chooses between `backend-js` and `backend-java`
- `CONTENT_DIR_HOST`: (set automatically) Path to your content directory (auto-converted for Windows/Cygwin)

---

### 🛠️ Frontend Installation (Manual/Development)

You can still run the frontend locally for development:

1. Clone the repository:
   ```bash
   git clone https://github.com/vebulos/tacia-docs.git
   cd tacia-docs
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```

See the backend instructions above for running a backend locally.

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
