import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
    title: 'goodsy\'s 기술 기록',
    tagline: '결제 정산·배치 시스템 백엔드 개발',
    favicon: 'img/favicon.ico',

    future: {
        v4: true,
    },

    // GitHub Pages (Project Pages) 설정
    url: 'https://goodsy.github.io',
    baseUrl: '/sykim-project/',

    organizationName: 'goodsy',
    projectName: 'sykim-project',

    //deploymentBranch: "gh-pages",
    //trailingSlash: false,

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

    i18n: {
        defaultLocale: 'ko',
        locales: ['ko'],
    },

    presets: [
        [
            "classic",
            {
             /*   docs: {
                    routeBasePath: "docs",
                    sidebarPath: require.resolve("./sidebars.ts"),
                    breadcrumbs: true,
                },*/

                blog: {
                    routeBasePath: "/",
                    blogTitle: "Blog",
                    blogDescription: "Recent posts",
                    showReadingTime: true,
                    postsPerPage: 10,
                   /* blogSidebar: {
                        // ✅ 소개를 sidebar로 고정
                        about: [
                            {
                                type: "html",
                                value: require("./src/components/BlogAbout").default,
                                defaultStyle: true,
                            },
                        ],
                    },*/
                },

                theme: {
                    customCss: require.resolve("./src/css/custom.css"),
                },
            },
        ],
    ],


    themeConfig: {
        image: 'img/docusaurus-social-card.jpg',
        colorMode: {
            defaultMode: "dark",
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: 'goodsy',

            items: [
                { to: "/", label: "Home", position: "left", className: "navbar-brand-text" },
                { to: "/tags/tech", label: "Tech", position: "left" },
                //{ to: "/tags/worklog", label: "Worklog", position: "left" },
                //{ to: "/tags/notes", label: "Notes", position: "left" },
                { to: "/archive", label: "Archive", position: "left" },
                {
                    href: 'https://github.com/goodsy',
                    label: 'GitHub',
                    position: 'right',
                },
            ],
        },

        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Contents',
                    items: [
                        //{ label: "Docs", to: "/docs/intro" },
                        { label: "Blog", to: "/" },
                    ],
                },
                {
                    title: 'Me',
                    items: [
                        {label: 'GitHub', href: 'https://github.com/goodsy'},
                        {label: 'Repository', href: 'https://github.com/goodsy/sykim-project'},
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Kim Su Yeon. Built with Docusaurus.`,
        },

        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ["java", "sql", "bash", "json"],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
