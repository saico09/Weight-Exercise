# Fotografías, fuentes y licencias

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
| `public/images/aurora-fitness.jpg` | Airam Dato-on | [Woman Running Outdoors in Black Athletic Wear, Pexels](https://www.pexels.com/photo/woman-running-outdoors-in-black-athletic-wear-29881497/) |
| `public/images/sand-fitness.jpg` | RAY LEI | [Yellow Toned Image of a Woman Meditating in Morning Sun, Pexels](https://www.pexels.com/photo/yellow-toned-image-of-a-woman-meditating-in-morning-sun-13849252/) |
| `public/images/motivation-kitten.jpg` | Pixabay, vía Pexels | [White and Grey Kitten on Brown and Black Leopard Print Textile, Pexels](https://www.pexels.com/photo/white-and-grey-kitten-on-brown-and-black-leopard-print-textile-45201/) |

Las cuatro fotografías de los temas están disponibles bajo la [licencia de Pexels](https://www.pexels.com/license/), que permite su uso gratuito en aplicaciones, incluso comerciales, y su modificación. No son fotografías de dominio público: se conservan los derechos de sus autores. La licencia prohíbe sugerir que las personas fotografiadas respaldan el producto, revender copias sin modificar o redistribuirlas como un banco de fotografías. Los retratos se usan únicamente como ambientación del selector de apariencia, sin asociarlos a resultados de salud ni testimonios.

Descargadas el 14 de octubre de 2026 desde el CDN oficial de Pexels, en JPEG de 1000 × 1500 píxeles con compresión de entrega:

- [Archivo fuente dark](https://images.pexels.com/photos/30284373/pexels-photo-30284373.jpeg?auto=compress&cs=tinysrgb&w=1000&q=85)
- [Archivo fuente light](https://images.pexels.com/photos/6712289/pexels-photo-6712289.jpeg?auto=compress&cs=tinysrgb&w=1000&q=85)

Aurora y Sand se descargaron el 15 de octubre de 2026, a 900 píxeles de ancho, para la bienvenida de Pro v0.6. Las fichas y la licencia se revisaron ese mismo día. La aplicación añade superposiciones de luz mediante CSS y conserva las fotografías originales descargadas:

- [Archivo fuente Aurora](https://images.pexels.com/photos/29881497/pexels-photo-29881497.jpeg?auto=compress&cs=tinysrgb&w=900&q=82)
- [Archivo fuente Sand](https://images.pexels.com/photos/13849252/pexels-photo-13849252.jpeg?auto=compress&cs=tinysrgb&w=900&q=82)

La fotografía final de Aurora muestra a una corredora de perfil con ropa deportiva negra y sin mirar a cámara. Su encuadre y el acento violeta se aplican mediante CSS, sin alterar el archivo original descargado.

El gatito de motivación se descargó el 15 de octubre de 2026, a 720 píxeles de ancho, desde el [CDN oficial](https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=720&q=82). Su ficha de Pexels lo identifica como «Free to use (CC0)». Se incluye como ilustración de la función de motivación, sin relación con marcas ni testimonios. Las imágenes que el usuario elija reemplazar se redimensionan en su dispositivo y no se agregan al repositorio.

## Fuentes locales

La interfaz incorpora los archivos de los paquetes `@fontsource` durante la compilación. Los PDF incluyen subconjuntos latinos TrueType en `public/fonts/report/`; se obtuvieron de los mismos paquetes al descomprimir sus contenedores WOFF con FontTools, sin cambiar los glifos. No se consultan servicios externos de fuentes al abrir la app ni al crear un informe.

| Familia | Uso en Pro v0.5 | Licencia incluida |
| --- | --- | --- |
| Barlow Condensed | Títulos Dark; PDF 600 | [SIL OFL 1.1](public/fonts/report/LICENSE-barlow-condensed.txt) |
| DM Sans | Texto Dark y Sand; PDF 400/600 | [SIL OFL 1.1](public/fonts/report/LICENSE-dm-sans.txt) |
| Manrope | Light; PDF 400/700 | [SIL OFL 1.1](public/fonts/report/LICENSE-manrope.txt) |
| Space Grotesk | Aurora; PDF 400/600 | [SIL OFL 1.1](public/fonts/report/LICENSE-space-grotesk.txt) |
| Fraunces | Títulos Sand; PDF 600 | [SIL OFL 1.1](public/fonts/report/LICENSE-fraunces.txt) |

Los avisos de autoría de cada familia se conservan en esas licencias y en sus paquetes. La SIL Open Font License 1.1 permite incluir e incrustar las fuentes bajo sus condiciones; no cambia la licencia de los informes creados con ellas. [Detalle de los archivos para PDF](public/fonts/report/README.md). El Excel usa nombres de fuentes del lector y no incrusta estas fuentes.
