# Recursos visuales

## Marca GreenBean

Se incluyen intactos los dos isotipos PNG transparentes oficiales del repositorio local StaticContentBucket, en static/content/GreenBean/General/Brand/: verde claro greenbean-8EB69B.png y verde oscuro greenbean-235347.png. El propietario autorizó su uso; no son recursos de dominio público.

Se muestran como imágenes PNG locales, sin fondo, borde ni color aplicado. El encuadre CSS equivale al viewBox 372 288 510 672 de la cabecera de GreenBean: elimina únicamente el lienzo transparente exterior y conserva la semilla completa. El verde claro se usa en fondos oscuros y el oscuro en los temas claros.

El crédito «Creada por GreenBean» aparece en el pie común de todas las secciones y en la bienvenida, junto al aviso de almacenamiento cuando corresponde. No necesita descargar imágenes ni consultar servicios externos.

| Copia local | SHA-256 (igual al original) |
| --- | --- |
| public/images/greenbean-brand.png | c6e1e17d7c5723d4fdde8de86dd1895d8a59c64e3ced3f26024ad8b17152e28c |
| public/images/greenbean-brand-on-light.png | fc159edae5c79849040f9110fbeaf53a9fe077c8ea4050612280211677cd75f2 |

## Fotografías

Las fotografías se incluyen como parte del diseño de la aplicación y se guardan localmente para que la experiencia no dependa de un servidor de imágenes.

| Archivo | Autor | Fuente |
| --- | --- | --- |
| `public/images/dark-fitness.jpg` | foad shariyati | [Man lifting weights in black gym attire, Pexels](https://www.pexels.com/photo/man-lifting-weights-in-black-gym-attire-30284373/) |
| `public/images/light-fitness.jpg` | Anna Tarazevich | [Woman Doing Yoga on the Beach with Arms Raised, Pexels](https://www.pexels.com/photo/woman-doing-yoga-on-the-beach-with-arms-raised-6712289/) |
| `public/images/motivation-kitten.jpg` | Pixabay, vía Pexels | [White and Grey Kitten on Brown and Black Leopard Print Textile, Pexels](https://www.pexels.com/photo/white-and-grey-kitten-on-brown-and-black-leopard-print-textile-45201/) |

Ambas están disponibles bajo la [licencia de Pexels](https://www.pexels.com/license/), que permite su uso gratuito en aplicaciones, incluso comerciales, y su modificación. No son fotografías de dominio público: se conservan los derechos de sus autores. La licencia prohíbe sugerir que las personas fotografiadas respaldan el producto, revender copias sin modificar o redistribuirlas como un banco de fotografías. Los retratos se usan únicamente como ambientación del selector de apariencia, sin asociarlos a resultados de salud ni testimonios.

Descargadas el 14 de octubre de 2026 desde el CDN oficial de Pexels, en JPEG de 1000 × 1500 píxeles con compresión de entrega:

- [Archivo fuente dark](https://images.pexels.com/photos/30284373/pexels-photo-30284373.jpeg?auto=compress&cs=tinysrgb&w=1000&q=85)
- [Archivo fuente light](https://images.pexels.com/photos/6712289/pexels-photo-6712289.jpeg?auto=compress&cs=tinysrgb&w=1000&q=85)

El gatito de motivación se descargó el 15 de octubre de 2026, a 720 píxeles de ancho, desde el [CDN oficial](https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=720&q=82). Su ficha de Pexels lo identifica como «Free to use (CC0)». Se incluye como ilustración de la función de motivación, sin relación con marcas ni testimonios. Las imágenes que el usuario elija reemplazar se redimensionan en su dispositivo y no se agregan al repositorio.

## Fuentes de las vistas previas de temas Pro en Basic

Las miniaturas y los diálogos bloqueados de Aurora y Sand usan estos subconjuntos latinos WOFF2, copiados de los paquetes Fontsource ya presentes en el proyecto Pro. Se conservan sin modificación y solo se aplican dentro de las vistas previas; no incorporan los temas globales ni sus funcionalidades.

| Archivo | Paquete de origen | Licencia incluida |
| --- | --- | --- |
| `public/fonts/previews/space-grotesk-latin-400-normal.woff2` | `@fontsource/space-grotesk` | `public/fonts/previews/Space-Grotesk-LICENSE.txt` — SIL Open Font License 1.1 |
| `public/fonts/previews/fraunces-latin-400-normal.woff2` | `@fontsource/fraunces` | `public/fonts/previews/Fraunces-LICENSE.txt` — SIL Open Font License 1.1 |

Las ilustraciones SVG de ondas y arena en `LockedProThemes.tsx` son originales del proyecto; no usan imágenes o recursos de terceros.
