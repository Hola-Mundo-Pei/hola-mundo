# Imágenes pendientes de exportar desde Figma

No pude descargar automáticamente los assets de Figma (el dominio de Figma
está bloqueado en mi entorno de ejecución). Debes exportarlos manualmente
desde el archivo de Figma y guardarlos en esta carpeta con estos nombres
exactos para que el HTML los reconozca:

| Nombre de archivo esperado   | Elemento en Figma                          | Tamaño aprox. |
|-------------------------------|---------------------------------------------|----------------|
| `logo.png`                   | "Diseño sin título 1" (logo del header)      | 40×40 px       |
| `bg-lines.png`                | "Frame 10446" (patrón de líneas de fondo)    | ~1980×1368 px  |
| `illustration-group.png`      | "Group" (ilustración central del hero)       | ~441×300 px    |
| `icon-que-es.png`             | Rectangle (ícono "Qué es Hola mundo")        | 60×60 px       |
| `icon-merch.png`               | "image 3" (ícono "Merch")                    | 60×60 px       |
| `icon-equipo.png`             | Rectangle 1 (ícono "El equipo")              | 60×60 px       |
| `icon-fotos.png`               | "image 1" (ícono "Fotos")                    | 50×50 px       |
| `icon-donar.png`               | "image 2" (ícono "Quiero donar")             | 50×50 px       |

## Cómo exportar desde Figma

1. Selecciona el elemento/capa en Figma.
2. En el panel derecho, baja hasta **Export**.
3. Elige formato **PNG** (o SVG si el elemento es vectorial simple) y escala 2x
   si quieres buena resolución en pantallas retina.
4. Clic en **Export [nombre]** y guarda el archivo con el nombre indicado en
   la tabla, dentro de esta carpeta (`assets/img/`).

Una vez tengas las imágenes aquí, la página `index.html` las mostrará
automáticamente — no hay que tocar el HTML.
