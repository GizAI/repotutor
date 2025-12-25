# Contributing to RepoTutor

First off, thank you for considering contributing to RepoTutor! It's people like you that make RepoTutor such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and expected**
- **Include screenshots if possible**
- **Include your environment details** (OS, Node.js version, browser)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List any alternatives you've considered**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code lints
5. Issue that pull request!

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/repotutor.git
cd repotutor

# Install dependencies
npm install

# Start development server
npm run dev
```

## Style Guide

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### TypeScript Style Guide

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable names
- Add comments for complex logic
- Export types when they might be useful elsewhere

### Component Guidelines

- Use functional components with hooks
- Keep components small and focused
- Use proper TypeScript types for props
- Follow the existing file structure

## Project Structure

```
src/
├── app/          # Next.js pages and layouts
├── components/   # React components
│   ├── layout/   # Header, Sidebar, etc.
│   ├── mdx/      # MDX-specific components
│   └── ui/       # Reusable UI components
├── lib/          # Utility functions and hooks
└── styles/       # Global styles
```

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing!
