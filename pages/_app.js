import Head from 'next/head'
import { useRouter } from 'next/router'
import AiAssistant from '@/components/AiAssistant'

// global styles must be imported only once in the custom App
import '../styles/globals.css'
import '../styles/navbar.css'
import '../styles/hero.css'
import '../styles/features.css'
import '../styles/plan.css'
import '../styles/dashboard.css'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  // Hide AI assistant on login and signup pages
  const hideAiPages = ['/login', '/signup']
  const showAi = !hideAiPages.includes(router.pathname)

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/images/logo.png" />
      </Head>
      <Component {...pageProps} />
      {showAi && <AiAssistant />}
    </>
  )
}
