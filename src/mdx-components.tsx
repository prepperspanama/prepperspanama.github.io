import type { MDXComponents } from 'mdx/types'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    // La página de cada post ya renderiza su propio <h1> (con la categoría
    // y la fecha); el "# Título" con el que arrancan los .mdx sirve como
    // bajada/titular editorial, no como un segundo encabezado de nivel 1.
    // Se renderiza como párrafo para no duplicar el <h1> por página (daña
    // SEO y el árbol de accesibilidad) y para no aparecer en la Tabla de
    // Contenidos, que solo indexa h2/h3.
    h1: (props) => (
      <p className="text-2xl md:text-3xl font-bold text-white leading-snug mb-8" {...props} />
    ),
  }
}
