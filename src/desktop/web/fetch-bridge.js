/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Adapta fetch HTTPS da interface de PC para a ponte IPC. O processo principal valida o pedido e devolve status, cabeçalhos e corpo.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
(function () {
  var original = window.fetch.bind(window);
  window.fetch = function (url, options) {
    if (!/^https:\/\//i.test(String(url))) return original(url, options);
    options = options || {};
    if (options.signal && options.signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return window.chplayerNative.fetch({
      url: String(url), method: options.method || 'GET',
      headers: options.headers || {}, body: options.body
    }).then(function (result) {
      if (options.signal && options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return new Response(result.body, { status: result.status, headers: result.headers });
    });
  };
})();
