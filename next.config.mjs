/** @type {import('next').NextConfig} */
const nextConfig = {
  // Section entry points that only forward to their default view. They live
  // here instead of calling `redirect()` in a page, which breaks React's dev
  // performance tracks ("cannot have a negative time stamp").
  async redirects() {
    return [
      // Module settings live in each module (e.g. /customers/statuses); these
      // keep the older addresses working.
      ...[
        ["customers", "statuses"],
        ["leads", "pipelines"],
        ["products", "categories"],
        ["services", "categories"],
      ].flatMap(([module, page]) => [
        {
          source: `/settings/${module}/:path*`,
          destination: `/${module}/${page}`,
          permanent: true,
        },
        {
          source: `/${module}/settings/:path*`,
          destination: `/${module}/${page}`,
          permanent: true,
        },
      ]),
      // The kanban is the default view of a pipeline.
      {
        source: "/leads/pipelines/:id",
        destination: "/leads/pipelines/:id/kanban",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
