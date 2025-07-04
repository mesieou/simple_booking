export default function Head() {
  return (
    <>
      <link rel="canonical" href="https://skedy.io/" />
      <meta name="robots" content="index, follow" />
      <meta property="og:title" content="Skedy | Booking Management Made Simple" />
      <meta property="og:description" content="The best way to manage bookings and calendars" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://skedy.io/" />
      <meta property="og:image" content="https://skedy.io/og-image.jpg" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Skedy | Booking Management Made Simple" />
      <meta name="twitter:description" content="The best way to manage bookings and calendars" />
      <meta name="twitter:image" content="https://skedy.io/og-image.jpg" />
      <script type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Skedy",
            "url": "https://skedy.io",
            "logo": "https://skedy.io/logo.png"
          }
        `}
      </script>
      {/* Los breadcrumbs se generarán dinámicamente en el cliente */}
    </>
  );
} 