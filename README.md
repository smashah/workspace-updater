# workspace-updater

`workspace-updater` is a command-line utility for auditing and updating the `catalog` in your `pnpm-workspace.yaml` file. It helps you keep your shared workspace dependencies up-to-date by checking them against the npm registry, grouping them by release type (major, minor, patch), and optionally updating them for you.

![workspace-updater-demo](https://user-images.githubusercontent.com/12345/67890.png) <!--- Placeholder for a demo GIF -->

## Why workspace-updater?

Managing shared dependencies in a pnpm workspace `catalog` can be tedious. `workspace-updater` automates this process, providing a clear, color-coded overview of what's outdated and giving you fine-grained control over what gets updated.

## Features

-   **Parallel Dependency Checking**: Fetches dependency information in parallel for a fast experience.
-   **Color-Coded Output**: Outdated dependencies are grouped by major, minor, and patch updates, with distinct colors for each.
-   **Automatic Updates**: An `--update` flag lets you automatically update the `pnpm-workspace.yaml` file.
-   **Selective Updating**: Combine `--update` with `--major`, `--minor`, or `--patch` to only update specific release types.
-   **Built for Bun**: Written in TypeScript and designed to run with the Bun runtime.

## Installation

To use `workspace-updater` in your own pnpm workspace, you can install it as a development dependency:

```bash
pnpm add -D workspace-updater
```

## Usage

You can run `workspace-updater` directly from your terminal using `pnpx`.

### Checking for Outdated Dependencies

To see a list of all outdated dependencies in your catalog, grouped by release type:

```bash
pnpx workspace-updater
```

### Updating Dependencies

To automatically update your `pnpm-workspace.yaml` with all the latest versions:

```bash
pnpx workspace-updater --update
```

### Selective Updates

You can also choose to only update certain types of releases.

**Update only patch releases:**

```bash
pnpx workspace-updater --update --patch
```

**Update minor and patch releases:**

```bash
pnpx workspace-updater --update --minor --patch
```

### Getting Help

To see the help menu with all available options:

```bash
pnpx workspace-updater --help
```

## Contributing

Contributions are welcome! If you have a feature request, bug report, or want to improve the code, please open an issue or submit a pull request.

## License

This utility is licensed under the MIT License.
