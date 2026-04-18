const nextConfig = {
  transpilePackages: ["@0g-databounty/shared"],
  turbopack: {
    root: new URL("../..", import.meta.url).pathname
  }
};

export default nextConfig;
