# Contributing to LLM Whiteboard

Thank you for your interest in contributing to LLM Whiteboard!

## Contributor License Agreement (CLA)

Before we can accept your contribution, you must sign our Contributor License Agreement. This ensures that:

1. You have the right to submit the contribution
2. You grant us a perpetual, worldwide, non-exclusive, royalty-free license to use your contribution
3. We can continue to offer LLM Whiteboard under the Elastic License 2.0 and as a managed service

When you open your first pull request, the CLA Assistant bot will prompt you to sign the agreement.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/your-org/llmwhiteboard/issues)
2. If not, create a new issue with:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version, etc.)

### Suggesting Features

Open a GitHub Issue with the "enhancement" label. Describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Submitting Code

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Write/update tests if applicable
5. Ensure the build passes (`npm run build`)
6. Commit with a clear message
7. Push to your fork
8. Open a Pull Request

### Code Style

- TypeScript for all new code
- Use existing patterns in the codebase
- Keep changes focused and minimal

## Project Structure

```
llmwhiteboard/
├── src/                 # Next.js frontend
├── backend/             # .NET API
├── cli/                 # CLI tool
└── docs/                # Documentation
```

## Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/llmwhiteboard.git
cd llmwhiteboard

# Start services
docker-compose up -d

# For CLI development
cd cli
npm install
npm run build
npm link
```

## Questions?

Open a GitHub Discussion or Issue if you have questions about contributing.
