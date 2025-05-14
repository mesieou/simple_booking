/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle CommonJS modules
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/(clone-deep|merge-deep|puppeteer-extra-plugin|puppeteer-extra)/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
          plugins: ['@babel/plugin-transform-modules-commonjs']
        }
      }
    });

    // Handle dynamic requires
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/(puppeteer-extra|puppeteer-extra-plugin)/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
          plugins: [
            ['@babel/plugin-transform-modules-commonjs'],
            ['@babel/plugin-transform-dynamic-import']
          ]
        }
      }
    });

    // Ignore specific modules that cause issues
    config.externals = [...(config.externals || []), 
      'puppeteer-extra-plugin-stealth',
      'puppeteer-extra-plugin'
    ];

    return config;
  },
  // Disable static optimization for the problematic route
  experimental: {
    serverComponentsExternalPackages: [
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
      'clone-deep',
      'merge-deep'
    ]
  }
};

module.exports = nextConfig; 