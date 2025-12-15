import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Docusaurus Tutorial - 5min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
      <Layout
          title="sykim 기술블로그"
          description="Backend · Spring · Batch · Settlement"
      >
          <main
              style={{
                  maxWidth: "720px",
                  margin: "0 auto",
                  padding: "6rem 1.5rem",
                  textAlign: "left",
              }}
          >
              <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
                  Su Yeon Tech History
              </h1>

              <p style={{ color: "var(--ifm-color-emphasis-600)", marginBottom: "2rem" }}>
                  백엔드 개발자로서의 실무 기록과 기술 정리
              </p>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                  <Link className="button button--primary" to="/blog">
                      Blog
                  </Link>
                  <Link className="button button--secondary" to="/docs/intro">
                      Notes
                  </Link>
              </div>
          </main>
      </Layout>
  );
}
