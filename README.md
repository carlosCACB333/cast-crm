# Next.js & HeroUI Template

This is a template for creating applications using Next.js 16 (app directory) and HeroUI (v3).

[Try it on CodeSandbox](https://githubbox.com/heroui-inc/heroui/next-app-template)

## Technologies Used

- [Next.js 16](https://nextjs.org/docs/getting-started)
- [HeroUI v3](https://heroui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Tailwind Variants](https://tailwind-variants.org)
- [TypeScript](https://www.typescriptlang.org/)
- [next-themes](https://github.com/pacocoursey/next-themes)

## How to Use

### Use the template with create-next-app

To create a new project based on this template using `create-next-app`, run the following command:

```bash
npx create-next-app -e https://github.com/heroui-inc/next-app-template
```

### Install dependencies

You can use one of them `npm`, `yarn`, `pnpm`, `bun`, Example using `npm`:

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

### Seed test products

Fill the products module of an organization with test data (development only):

```bash
bun run db:seed:products --org <slug> [--count 40] [--reset] [--seed 1]
```

`--reset` removes the products tagged `demo` created by a previous run.

## License

Licensed under the [MIT license](https://github.com/heroui-inc/next-app-template/blob/main/LICENSE).
