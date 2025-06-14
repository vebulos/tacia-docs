# Content API Documentation

This document describes the available endpoints in the Content API.

## Base URL

The API is available at: `http://localhost:4201/api`

## Endpoints

### 1. Get File Content

```
GET /api/content?path=<path>
```

Parameters:
- `path` (required): Relative path of the file to retrieve

Example request:
```
GET /api/content?path=guides/getting-started.md
```

### 2. Get Related Documents

```
GET /api/related?path=<path>&limit=<limit>
```

Parameters:
- `path` (required): Path of the document to find related content for
- `limit` (optional, default: 5): Maximum number of documents to return

Example request:
```
GET /api/related?path=guides/getting-started.md&limit=3
```

Example response:
```json
{
  "related": [
    {
      "path": "guides/advanced-usage.md",
      "title": "Advanced Usage",
      "commonTags": ["tutorial", "beginner"],
      "commonTagsCount": 2
    },
    {
      "path": "api/reference.md",
      "title": "API Reference",
      "commonTags": ["reference"],
      "commonTagsCount": 1
    }
  ]
}
```

## Metadata Format

Markdown files can include YAML front matter delimited by `---`:

```yaml
---
title: My Document
tags:
  - tag1
  - tag2
---

# Document content...
```

## Error Handling

In case of an error, the API returns a JSON object with the following fields:
- `error`: Error type
- `message`: Error description
- `details`: Additional details (in development environment)

### Common Error Codes

- `400 Bad Request`: Invalid request (missing or invalid parameters)
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Complete Example with cURL

```bash
# Get file content
curl "http://localhost:4201/api/content?path=guides/getting-started.md"

# Get related documents
curl "http://localhost:4201/api/related?path=guides/getting-started.md&limit=3"
```

## Development Notes

- The server recursively scans the content directory for Markdown files
- File metadata is cached for better performance
- Paths are normalized to work across different operating systems
