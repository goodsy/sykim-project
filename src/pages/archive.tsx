import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

export default function Archive() {
    return (
        <Layout title="Archive" description="Posts index">
            <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
                <h1 style={{ marginBottom: "0.6rem" }}>Archive</h1>
                <p style={{ color: "var(--ifm-color-emphasis-700)", lineHeight: 1.7 }}>
                    전체 글을 탐색하기 위한 페이지입니다.
                </p>

                <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
                    <Link className="button button--primary" to="/blog">
                        Blog (최근 글)
                    </Link>

                    <Link className="button button--secondary" to="/blog/tags">
                        Categories (태그)
                    </Link>

                    <Link className="button button--secondary" to="/blog/authors">
                        Authors
                    </Link>
                </div>
            </main>
        </Layout>
    );
}
