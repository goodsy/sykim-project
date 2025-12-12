import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
    title: 'Kim Su Yeon',
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

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

    i18n: {
        defaultLocale: 'ko',
        locales: ['ko'],
    },

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                    // 네 repo로 바꾸는 게 맞음 (원래는 docusaurus 템플릿 URL이었음)
                    editUrl: 'https://github.com/goodsy/sykim-project/tree/main/',
                },
                blog: {
                    showReadingTime: true,
                    feedOptions: {
                        type: ['rss', 'atom'],
                        xslt: true,
                    },
                    editUrl: 'https://github.com/goodsy/sykim-project/tree/main/',
                    onInlineTags: 'warn',
                    onInlineAuthors: 'warn',
                    onUntruncatedBlogPosts: 'warn',
                },
                theme: {
                    customCss: './src/css/custom.css',
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        image: 'img/docusaurus-social-card.jpg',
        colorMode: {
            respectPrefersColorScheme: true,
        },

        navbar: {
            title: 'Kim Su Yeon',
            logo: {
                alt: 'Kim Su Yeon Logo',
                src: 'img/logo.svg',
            },
            items: [
                // ✅ docs 라우팅은 "type: doc" / "type: docSidebar"를 쓰는 게 제일 안전함
                {
                    type: 'doc',
                    docId: 'intro',
                    position: 'left',
                    label: '포트폴리오',
                },
                {to: '/about', label: '소개', position: 'left'},
                {to: '/blog', label: '기술블로그', position: 'left'},

                {
                    href: 'https://github.com/goodsy/sykim-project',
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
                        // ✅ /docs 대신 실제 문서로 링크 (깨질 확률 가장 낮음)
                        {label: '포트폴리오', to: '/docs/intro'},
                        {label: '기술블로그', to: '/blog'},
                        {label: '소개', to: '/about'},
                    ],
                },
                {
                    title: 'Links',
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
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
