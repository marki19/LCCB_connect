// @ts-nocheck
// Supabase Edge Functions use Deno, so we ignore Node/React Native TypeScript errors here
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch the target URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LCCBConnectBot/1.0',
      },
    })

    const html = await response.text()

    // Lightweight Regex extraction for Open Graph tags
    const getMetaTag = (property: string) => {
      const regex = new RegExp(`<meta(?:[^>]+)property=["']${property}["'](?:[^>]+)content=["']([^"']+)["']`, 'i')
      const match = html.match(regex)
      if (match) return match[1]
      
      // Fallback for reversed order attributes: content="..." property="..."
      const regexReverse = new RegExp(`<meta(?:[^>]+)content=["']([^"']+)["'](?:[^>]+)property=["']${property}["']`, 'i')
      const matchReverse = html.match(regexReverse)
      return matchReverse ? matchReverse[1] : null
    }

    // Fallback title regex
    const getTitle = () => {
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      return match ? match[1] : null
    }

    const preview = {
      title: getMetaTag('og:title') || getTitle() || url,
      description: getMetaTag('og:description') || null,
      image: getMetaTag('og:image') || null,
      url: getMetaTag('og:url') || url,
    }

    return new Response(
      JSON.stringify(preview),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
