(function () {
  var GA = 'G-9Z3TJ93WGL';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA);
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
  document.head.appendChild(script);

  document.addEventListener('click', function (event) {
    if (!event.target || typeof event.target.closest !== 'function') return;
    var link = event.target.closest('a');
    if (!link) return;
    var destination;
    try { destination = new URL(link.href, document.baseURI); }
    catch (_) { return; }
    if (destination.protocol !== 'https:' && destination.protocol !== 'http:') return;
    var host = destination.hostname.toLowerCase();
    var partner;
    if (host === 'amazon.com' || host.endsWith('.amazon.com') || host === 'amzn.to') {
      partner = 'Amazon';
    } else if (host === 'tidd.ly' && link.dataset.affiliatePartner === 'Craighill') {
      partner = 'Craighill';
    } else {
      return;
    }
    window.gtag('event', 'affiliate_click', {
      affiliate_partner: partner,
      product_name: link.dataset.product || document.title,
      destination_url: destination.href
    });
  });
})();
