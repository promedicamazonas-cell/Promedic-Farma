        let productos = [];
        let carrito = [];
        let promos = [];
        let notas = [];
        let promoIdx = 0;
        let promoTimer = null;
        // El catalogo abre en Dermatologicos: 91% tiene foto y ninguno pide receta,
        // frente a Medicamentos donde el 69% no tiene imagen. Si la categoria no
        // existiera en la hoja, se cae de vuelta a 'Todas'.
        const CATEGORIA_INICIAL = 'Dermatológicos';
        let categoriaActual = 'Todas';
        let letraActual = '';
        function loteProductos() { return window.innerWidth <= 640 ? 8 : 15; }
        let paginaProductos = loteProductos();
        let totalFiltrados = 0;

        function inicial(nombre) {
            let c = ((nombre || '').trim().charAt(0) || '').toUpperCase();
            const map = { 'Á':'A','À':'A','Ä':'A','Â':'A','É':'E','È':'E','Ë':'E','Ê':'E','Í':'I','Ì':'I','Ï':'I','Î':'I','Ó':'O','Ò':'O','Ö':'O','Ô':'O','Ú':'U','Ù':'U','Ü':'U','Û':'U','Ñ':'N' };
            if (map[c]) c = map[c];
            return /[A-Z]/.test(c) ? c : '#';
        }

        async function cargarProductos() {
            try {
                const csvUrl = 'https://docs.google.com/spreadsheets/d/182UZKEzDkVuph-woSp-ZjA6adIU1HTisEatJpxRCFvM/gviz/tq?tqx=out:csv&headers=1&gid=2093510093';
                const response = await fetch(csvUrl);
                const csv = await response.text();

                Papa.parse(csv, {
                    header: true,
                    transformHeader: (h) => h.trim(),
                    skipEmptyLines: true,
                    complete: (results) => {
                        const filas = results.data.filter(p => p.nombre && p.nombre.trim());
                        const esPromo = (n) => /^promo\s*\d*$/i.test((n || '').trim());
                        // Notas de cuidado de la piel: filas NOTA, NOTA2, NOTA3... en la misma hoja.
                        const esNota = (n) => /^nota\s*\d*$/i.test((n || '').trim());
                        notas = filas
                            .filter(p => esNota(p.nombre))
                            .map(p => ({ img: (p.imagen || '').trim(), titulo: (p.descripcion || '').trim(), bajada: (p.uso || '').trim(), cta: (p.cta || '').trim(), link: (p.link || '').trim() }))
                            .filter(n => n.titulo);
                        promos = filas
                            .filter(p => esPromo(p.nombre))
                            .map(p => ({ img: (p.imagen || '').trim(), titulo: (p.descripcion || '').trim(), bajada: (p.uso || '').trim(), cta: (p.cta || '').trim(), link: (p.link || '').trim() }))
                            .filter(pr => pr.img);
                        productos = filas
                            .filter(p => !esPromo(p.nombre) && !esNota(p.nombre))
                            .map(p => {
                                const cv = (p.condicion_venta || '').trim().toLowerCase();
                                const recetaSi = /^(s[ií]|x|1|true|requiere)/i.test((p.receta || '').trim());
                                let cond;
                                if (cv.includes('controlad')) cond = 'CONTROLADO';
                                else if (cv.includes('receta')) cond = 'RECETA';
                                else if (cv.includes('libre') || cv.includes('otc')) cond = 'LIBRE';
                                else if (recetaSi) cond = 'RECETA';
                                else cond = /medicament/i.test(p.categoria || '') ? 'RECETA' : 'LIBRE';
                                return {
                                    id: p.id || '',
                                    nombre: p.nombre || '',
                                    concentracion: p.concentracion || '',
                                    formaFarmaceutica: p.formaFarmaceutica || '',
                                    fabricante: p.fabricante || '',
                                    categoria: p.categoria || '',
                                    imagen: (p.imagen || '').trim(),
                                    imagen2: (p.imagen2 || '').trim(),
                                    imagen3: (p.imagen3 || '').trim(),
                                    descripcion: (p.descripcion || '').trim(),
                                    uso: (p.uso || '').trim(),
                                    principio: (p.principio_activo || p.principio || '').trim(),
                                    advertencias: (p.advertencias || '').trim(),
                                    receta: (p.receta || '').trim(),
                                    cond: cond,
                                    precio_por_unidad: parseFloat(p.precio_por_unidad) || 0,
                                    stock_unidades: parseInt(p.stock_unidades) || 0,
                                    destacado: parseInt(p.destacado) || 0
                                };
                            })
                            .filter(p => p.stock_unidades > 0 && p.cond !== 'CONTROLADO');
                        productos.forEach((p, i) => { p._k = i; });
                        productos.forEach(p => {
                            p._busq = normaliza([p.nombre, p.concentracion, p.fabricante, p.categoria, p.formaFarmaceutica, p.descripcion, p.uso, p.principio].join(' '));
                            // El nombre y la marca aparte: valen mucho mas que una
                            // coincidencia perdida dentro de una descripcion.
                            p._nom = normaliza(p.nombre);
                            p._marca = normaliza([p.fabricante, p.principio].join(' '));
                        });

                        if (!productos.length) {
                            document.getElementById('loading').innerHTML = '⚠️ No se pudieron cargar los productos en este momento. Revisa tu conexión y vuelve a cargar la página.';
                            return;
                        }

                        if (productos.some(p => p.categoria === CATEGORIA_INICIAL)) categoriaActual = CATEGORIA_INICIAL;

                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('table-container').style.display = 'block';
                        renderDestacados();
                        renderNotas();
                        generarBotonesCategorias();
                        generarNav();
                        renderProducts();
                        renderPromo();
                    },
                    error: (error) => {
                        console.error('Error en Papa Parse:', error);
                        document.getElementById('loading').innerHTML = '⚠️ Error cargando productos.';
                    }
                });
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('loading').innerHTML = '⚠️ Error cargando productos.';
            }
        }

        function categoriasLista() {
            return ['Todas', ...new Set(productos.map(p => p.categoria).filter(c => c))];
        }

        function generarBotonesCategorias() {
            const container = document.getElementById('categories-container');
            container.innerHTML = categoriasLista().map(cat => `
                <button class="${categoriaActual === cat ? 'active' : ''}" onclick="filterCat('${cat.replace(/'/g, "\\'")}')">
                    ${cat}
                </button>
            `).join('');
        }

        function catIcon(cat) {
            const c = (cat || '').toLowerCase();
            if (/medicament|farmac/.test(c)) return '💊';
            if (/personal|shampoo|jabon|desodor|higiene personal/.test(c)) return '🚿';
            if (/dermat|piel|cuida/.test(c)) return '🧴';
            if (/vitamin|suplement/.test(c)) return '💪';
            if (/bebe|beb|mam|niñ|infant/.test(c)) return '🍼';
            if (/dispositiv|equipo/.test(c)) return '🩺';
            if (/higien|aseo/.test(c)) return '🧼';
            if (/belleza|cosm|maquil/.test(c)) return '💄';
            return '🏷️';
        }

        function generarNav() {
            const nav = document.getElementById('cat-nav');
            nav.innerHTML = categoriasLista().map(cat => `
                <a class="${categoriaActual === cat ? 'active' : ''}" onclick="navCat('${cat.replace(/'/g, "\\'")}')">
                    <span class="cat-ico">${cat === 'Todas' ? '🏠' : catIcon(cat)}</span>${cat}
                </a>
            `).join('');
            renderDrawer();
        }

        function navCat(cat) {
            categoriaActual = cat;
            letraActual = '';
            paginaProductos = loteProductos();
            generarBotonesCategorias();
            generarNav();
            renderProducts();
            const dest = document.getElementById('catalogo');
            if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function renderDrawer() {
            const el = document.getElementById('drawer-list');
            if (!el) return;
            el.innerHTML = categoriasLista().map(cat => {
                const ico = cat === 'Todas' ? '🏠' : catIcon(cat);
                return `<a class="${categoriaActual === cat ? 'active' : ''}" onclick="navCatDrawer('${cat.replace(/'/g, "\\'")}')"><span class="d-ico">${ico}</span>${cat}<span class="d-arrow">›</span></a>`;
            }).join('');
        }
        function openDrawer() {
            document.getElementById('drawer').classList.add('open');
            document.getElementById('drawer-backdrop').classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function closeDrawer() {
            document.getElementById('drawer').classList.remove('open');
            document.getElementById('drawer-backdrop').classList.remove('open');
            document.body.style.overflow = '';
        }
        function navCatDrawer(cat) {
            closeDrawer();
            navCat(cat);
        }
        function navDrawerAction(accion) {
            closeDrawer();
            if (accion === 'consulta') openConsultaModal();
            else if (accion === 'club') openClubModal();
            else if (accion === 'ruleta') openRuleta();
            else if (accion === 'mipiel') openMiPiel();
            else if (accion === 'test') openTest();
            else if (accion === 'intimo') openTestIntimo();
            else if (accion === 'libro') openLibroModal();
            else if (accion === 'wa') window.open('https://wa.me/51935896961?text=' + encodeURIComponent('Hola ProMedic 👋, quisiera hacer un pedido / consulta.'), '_blank');
        }

        function generarLetras() {
            const base = productos.filter(p => categoriaActual === 'Todas' || p.categoria === categoriaActual);
            const letras = [...new Set(base.map(p => inicial(p.nombre)))].sort();
            const container = document.getElementById('letras-container');
            container.innerHTML =
                `<button class="${letraActual === '' ? 'active' : ''}" onclick="filterLetra('')">Todos</button>` +
                letras.map(l => `<button class="${letraActual === l ? 'active' : ''}" onclick="filterLetra('${l}')">${l}</button>`).join('');
        }

        function filterLetra(l) {
            letraActual = l;
            paginaProductos = loteProductos();
            renderProducts();
        }

        function normalizeImg(u) {
            u = (u || '').trim();
            const m = u.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]+)$/);
            if (m) return 'https://i.imgur.com/' + m[1] + '.png';
            const m2 = u.match(/^https?:\/\/i\.imgur\.com\/([A-Za-z0-9]+)$/);
            if (m2) return 'https://i.imgur.com/' + m2[1] + '.png';
            return u;
        }
        // Miniatura más liviana de imgur para las tarjetas (sz: 'm'=320px, 'l'=640px).
        // Carga mucho más rápido; la ficha del producto usa la imagen completa.
        function imgThumb(u, sz) {
            const m = String(u || '').match(/^https?:\/\/i\.imgur\.com\/([A-Za-z0-9]+)\.(jpe?g|png|gif|webp)$/i);
            if (m) return 'https://i.imgur.com/' + m[1] + sz + '.' + m[2];
            return u;
        }

        function formIcon(forma) {
            const f = (forma || '').toLowerCase();
            const ic = (paths) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#0f4c9a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
            if (/(inyect|ampoll|vial|jeringa)/.test(f))
                return ic('<path d="M13 5l-8 8-2 5 5-2 8-8"/><path d="M9 11l4 4"/><path d="M15 3l6 6"/><path d="M13 7l4 4"/>');
            if (/(jarabe|suspensi|soluci|elixir|loci|frasco|liquido|líquido|gotas|emulsi)/.test(f))
                return ic('<path d="M9 3h6v2l1 2v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7l1-2z"/><path d="M8 12h8"/>');
            if (/(crema|pomada|\bgel\b|unguento|ungüento|pasta dental)/.test(f))
                return ic('<path d="M9 4h6l-1 4H10z"/><path d="M8 8h8v9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z"/>');
            if (/(capsula|cápsula|blanda)/.test(f))
                return ic('<rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5v7"/>');
            if (/(tableta|comprimido|pastilla|gragea|masticable|recubiert)/.test(f))
                return ic('<circle cx="12" cy="12" r="8"/><path d="M6.5 12h11"/>');
            if (/(spray|aerosol|inhalad|nebuliz)/.test(f))
                return ic('<rect x="8" y="8" width="7" height="12" rx="1"/><path d="M9 8V5h5v3"/><path d="M17 5h2M17 8h3M18 11h2"/>');
            if (/(polvo|sobre|granulad|sache|efervescente)/.test(f))
                return ic('<path d="M5 4h14l-1 16H6z"/><path d="M5 4l3 3h8l3-3"/>');
            if (/(ovulo|óvulo|supositorio)/.test(f))
                return ic('<path d="M12 3c3 4 4 7 4 10a4 4 0 0 1-8 0c0-3 1-6 4-10z"/>');
            return ic('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>');
        }

        function normaliza(s) {
            return (s || '').toLowerCase()
                .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
                .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').trim();
        }
        function lev(a, b) {
            const m = a.length, n = b.length;
            if (!m) return n; if (!n) return m;
            let prev = Array.from({ length: n + 1 }, (_, i) => i);
            for (let i = 1; i <= m; i++) {
                const cur = [i];
                for (let j = 1; j <= n; j++) {
                    cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
                }
                prev = cur;
            }
            return prev[n];
        }
        function enTexto(hay, token) {
            if (hay.includes(token)) return true;
            if (token.length < 4) return false;
            const maxD = token.length >= 9 ? 2 : 1;
            const words = hay.split(/[^a-z0-9]+/);
            for (const w of words) {
                if (!w || Math.abs(w.length - token.length) > maxD) continue;
                if (lev(w, token) <= maxD) return true;
            }
            return false;
        }
        const sinonimos = {
            'gripe':'antigripal gripa resfrio resfriado paracetamol comtrex tapsin',
            'gripa':'antigripal gripe resfrio paracetamol comtrex tapsin',
            'resfrio':'antigripal gripe gripa paracetamol',
            'resfriado':'antigripal gripe paracetamol',
            'dolor de cabeza':'paracetamol ibuprofeno naproxeno analgesico migra',
            'cabeza':'paracetamol ibuprofeno analgesico',
            'migrana':'paracetamol migradorixina',
            'dolor':'paracetamol ibuprofeno naproxeno analgesico',
            'fiebre':'paracetamol ibuprofeno antipiretico panadol',
            'tos':'ambroxol jarabe mucolitico expectorante bromhexina dextrometorfano muxol atos',
            'flema':'ambroxol mucolitico acetilcisteina',
            'garganta':'paracetamol antigripal',
            'alergia':'loratadina cetirizina clorfenamina antialergico',
            'rinitis':'loratadina cetirizina antialergico',
            'acne':'effaclar limpiador imperfecciones',
            'espinilla':'effaclar acne',
            'piel grasa':'effaclar matificante seborreico',
            'piel seca':'lipikar cerave hidratante ureadin nutratopic',
            'atopica':'lipikar nutratopic',
            'manchas':'mela glicoisdin antimanchas fotoultra',
            'melasma':'mela antimanchas',
            'arrugas':'retinol retinal antiedad',
            'protector solar':'anthelios fotoprotector fusion water bloqueador solar dermaglos',
            'bloqueador':'anthelios fotoprotector fusion solar',
            'sol':'anthelios fotoprotector fusion solar',
            'gastritis':'omeprazol antiacido hidroxido',
            'acidez':'antiacido hidroxido omeprazol simeticona',
            'colico':'buscapina busdol antiespasmodico',
            'gases':'simeticona aero',
            'estrenimiento':'laxante lactulosa laxaliv',
            'diarrea':'suero rehidratante',
            'nauseas':'dimenhidrinato',
            'mareo':'dimenhidrinato gravax',
            'quemadura':'cicaplast reparador',
            'herida':'cicaplast reparador procicar',
            'panal':'pomada pañal',
            'bebe':'baby johnson pañal',
            'defensas':'vitamina c zinc multivitaminico',
            'energia':'multivitaminico oramin energiforte',
            'cansancio':'hierro multivitaminico complejo',
            'anemia':'hierro sulfato ferroso ferroviton anemiplus',
            'hierro':'ferroso ferroviton anemiplus hierronim',
            'huesos':'calcio vitamina d calcium',
            'articulaciones':'colageno glucosamina condroitina arthron activflex',
            'colageno':'colageno activflex',
            'cabello':'biotina',
            'sueno':'melatonina',
            'insomnio':'melatonina',
            'estres':'ashwagandha',
            'intimo':'sebamed intimo',
            'hongos':'clotrimazol antimicotico ketoconazol terbinafina micosolin',
            'omega':'omega fish oil pescado',
            'parasito':'mebendazol albendazol zentel',
            'shampoo':'shampoo champu anticaspa',
            'jabon':'jabon jabones',
            'desodorante':'desodorante antitranspirante',
            'higiene intima':'intimo intima femenino toalla sanitaria nocturna'
        };

        // Evita falsos positivos: estos productos NO deben engancharse por un ingrediente
        // secundario (paracetamol/analgésico). Igual aparecen por nombre o en su chip real.
        const bloqueoSinonimo = {
            'busdol': ['paracetamol', 'analgesico'],
            'clorzodisten': ['paracetamol', 'analgesico']
        };

        /* Relevancia de una busqueda.
           Sin esto, buscar "mat" devolvia 134 productos: "mat" esta dentro de
           antiinflaMATorio y derMATologicos, en descripciones y categorias. El
           unico con MAT en el nombre (Effaclar Mat) quedaba en el puesto 19 y no
           se veia, porque en movil solo se muestran 8. Ahora el nombre manda. */
        function relevancia(p, toks) {
            let s = 0;
            for (const x of toks) {
                const nom = p._nom || '';
                if (nom.startsWith(x.t)) s += 100;        // el nombre empieza asi
                else if (x.re.test(nom)) s += 70;         // empieza una palabra del nombre
                else if (nom.includes(x.t)) s += 40;      // esta dentro del nombre
                else if ((p._marca || '').includes(x.t)) s += 15;  // marca o principio activo
            }
            return s;
        }

        // Orden de vitrina: primero lo que se ve bien y se puede comprar de una.
        // Una tarjeta sin foto o con "requiere receta" es la que peor primera
        // impresion deja, asi que va al final. No se esconde nada, solo se ordena.
        function pesoVitrina(p) {
            return (p.imagen ? 0 : 2) + (p.cond === 'RECETA' ? 1 : 0);
        }
        function ordenVitrina(a, b) {
            const d = pesoVitrina(a) - pesoVitrina(b);
            return d !== 0 ? d : a.nombre.localeCompare(b.nombre, 'es');
        }

        /* ---------------------------------------------------------------
           NOTAS DE CUIDADO DE LA PIEL
           Se editan en el Sheet, en filas cuyo nombre sea NOTA, NOTA2, NOTA3...
             descripcion -> titulo      uso  -> texto
             imagen      -> foto        cta  -> texto del boton
             link        -> termino que se busca al pulsar (o una URL completa)
           Sin filas NOTA el bloque no aparece.
        --------------------------------------------------------------- */
        function renderNotas() {
            const caja = document.getElementById('notas-card');
            const cont = document.getElementById('notas-row');
            if (!caja || !cont) return;
            if (!notas.length) { caja.style.display = 'none'; return; }
            cont.innerHTML = notas.map(n => {
                const ruta = n.img ? (n.img.startsWith('http') ? normalizeImg(n.img) : 'fotos/' + n.img) : '';
                const foto = ruta ? `<img src="${imgThumb(ruta, 'l')}" alt="" loading="lazy" onerror="this.style.display='none';" />` : '';
                const texto = n.cta || 'Ver productos';
                const accion = /^https?:/i.test(n.link)
                    ? `<a class="nota-cta" href="${n.link}" target="_blank" rel="noopener">${texto} &rsaquo;</a>`
                    : `<button class="nota-cta" onclick="verNota('${n.link.replace(/'/g, "\\'")}')">${texto} &rsaquo;</button>`;
                return `<article class="nota">${foto}<div class="nota-txt"><h4>${n.titulo}</h4><p>${n.bajada}</p>${n.link ? accion : ''}</div></article>`;
            }).join('');
            caja.style.display = 'block';
        }

        // Al pulsar una nota se busca su termino en el catalogo, no se abre otra pagina.
        function verNota(termino) {
            if (!termino) return;
            const inp = document.getElementById('search');
            inp.value = termino;
            categoriaActual = 'Todas'; letraActual = ''; paginaProductos = loteProductos();
            actualizarClear(); generarBotonesCategorias(); generarNav(); renderProducts();
            track('nota_click', { termino: termino });
            const dest = document.getElementById('catalogo');
            if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function renderProducts() {
            const rawQ = normaliza(document.getElementById('search').value);
            let synWords = [];
            if (rawQ) {
                for (const key in sinonimos) { if (rawQ.includes(key)) synWords = synWords.concat(sinonimos[key].split(' ')); }
            }
            const tokens = rawQ ? rawQ.split(/\s+/).filter(t => t.length >= 2) : [];
            const toks = tokens.map(t => ({ t: t, re: new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
            const filtrados = productos.filter(p => {
                if (!(categoriaActual === 'Todas' || p.categoria === categoriaActual)) return false;
                if (!(letraActual === '' || inicial(p.nombre) === letraActual)) return false;
                if (!rawQ) return true;
                const hay = p._busq || '';
                if (tokens.length && tokens.every(t => enTexto(hay, t))) return true;
                if (synWords.length) {
                    for (const w of synWords) {
                        if (w.length < 3 || !hay.includes(w)) continue;
                        let bloqueado = false;
                        for (const pref in bloqueoSinonimo) {
                            if (hay.startsWith(pref) && bloqueoSinonimo[pref].includes(w)) { bloqueado = true; break; }
                        }
                        if (!bloqueado) return true;
                    }
                }
                return false;
            }).sort((a, b) => {
                if (toks.length) {
                    const d = relevancia(b, toks) - relevancia(a, toks);
                    if (d !== 0) return d;
                }
                return ordenVitrina(a, b);
            });

            const html = filtrados.slice(0, paginaProductos).map((p) => {
                const cardImgs = [p.imagen, p.imagen2, p.imagen3].map(x => (x || '').trim()).filter(Boolean).map(s => imgThumb(s.startsWith('http') ? normalizeImg(s) : 'fotos/' + s, 'l'));
                const imgSrc = cardImgs[0] || '';
                const multi = cardImgs.length > 1;
                const iconHtml = formIcon(p.formaFarmaceutica);
                const imgBlock = imgSrc
                    ? `<img src="${imgSrc}" alt="${p.nombre}" loading="lazy" class="product-card-img${multi ? ' pc-rot' : ''}"${multi ? ` data-imgs="${cardImgs.join('|')}"` : ''} onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="product-card-img-empty" style="display:none;">${iconHtml}</div>`
                    : `<div class="product-card-img-empty">${iconHtml}</div>`;
                const conc = (p.concentracion || '').trim();
                const tieneConc = conc && conc.toUpperCase() !== 'N/A';
                const rxTag = p.cond === 'RECETA' ? `<div class="pc-rx">📋 Requiere receta</div>` : '';
                const accionBtn = p.cond === 'RECETA'
                    ? `<button class="pc-btn pc-btn-rx" onclick="event.stopPropagation(); solicitarReceta(${p._k})">📋 Solicitar con receta</button>`
                    : `<button class="pc-btn" onclick="event.stopPropagation(); addCart(${p._k})">Agregar al carrito</button>`;
                return `
                <div class="product-card" onclick="openFicha(${p._k})">
                    ${imgBlock}
                    <div class="pc-name">${p.nombre}${tieneConc ? ` <span class="pc-conc-in">${conc}</span>` : ''}</div>
                    ${rxTag}
                    <div class="pc-foot">
                        ${p.precio_por_unidad > 0
                            ? `<div class="pc-price-old">S/. ${p.precio_por_unidad.toFixed(2)}</div><div class="pc-price">S/. ${(p.precio_por_unidad * 0.9).toFixed(2)}<span class="pc-off">-10%</span></div>`
                            : `<div class="pc-price">S/. ${p.precio_por_unidad.toFixed(2)}</div>`}
                        ${accionBtn}
                    </div>
                </div>
            `;
            }).join('');

            document.getElementById('products-grid').innerHTML = html || '<p style="grid-column:1/-1; text-align:center; color:#6b7280; padding:20px;">No se encontraron productos.</p>';
            totalFiltrados = filtrados.length;
            const vm = document.getElementById('ver-mas-cont');
            if (vm) {
                if (paginaProductos < totalFiltrados) {
                    const restantes = totalFiltrados - paginaProductos;
                    vm.style.display = 'block';
                    vm.innerHTML = `<button class="ver-mas-btn" onclick="verMasProductos()">Ver más <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>`;
                } else {
                    vm.style.display = 'none';
                    vm.innerHTML = '';
                }
            }
        }

        function filterCat(cat) {
            categoriaActual = cat;
            letraActual = '';
            paginaProductos = loteProductos();
            generarBotonesCategorias();
            generarNav();
            renderProducts();
        }

        function solicitarReceta(k) {
            const p = productos[k];
            if (!p) return;
            track('solicitar_receta', { producto: p.nombre });
            const conc = (p.concentracion || '').trim();
            const tieneConc = conc && conc.toUpperCase() !== 'N/A';
            const msg = `📋 SOLICITUD DE PRODUCTO CON RECETA - PROMEDIC\n\nProducto: ${p.nombre}${tieneConc ? ' ' + conc : ''}\n\nEste producto requiere receta médica. Adjunto la foto de mi receta para que el Químico Farmacéutico la valide antes de la entrega.`;
            window.open(`https://wa.me/51935896961?text=${encodeURIComponent(msg)}`, '_blank');
        }

        function addCart(k) {
            const p = productos[k];
            if (!p) return;
            if (p.cond === 'RECETA' || p.cond === 'CONTROLADO') { solicitarReceta(k); return; }

            const existe = carrito.find(item => item._k === p._k);
            if (existe) {
                existe.cantidad++;
            } else {
                carrito.push({...p, cantidad: 1});
            }
            track('agregar_carrito', { producto: p.nombre, valor: +(p.precio_por_unidad * 0.9).toFixed(2) });
            updateCart();
            document.getElementById('cart-modal').classList.add('active');
        }

        function updateCart() {
            const items = carrito.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-details">
                        <strong>${item.nombre}</strong><br/>
                        <span style="font-size: 11px; color: #6b7280;">S/. ${item.precio_por_unidad.toFixed(2)} c/u</span>
                    </div>
                    <div class="cart-item-controls">
                        <button class="qty-btn" onclick="modCant(${idx}, -1)">−</button>
                        <input class="qty-input" type="number" value="${item.cantidad}" onchange="modCant(${idx}, this.value - ${item.cantidad})" />
                        <button class="qty-btn" onclick="modCant(${idx}, 1)">+</button>
                        <span style="min-width: 60px; text-align: right; font-weight: bold;">S/. ${(item.precio_por_unidad * item.cantidad).toFixed(2)}</span>
                    </div>
                </div>
            `).join('');

            document.getElementById('cart-items').innerHTML = items || '<p style="color: #6b7280; text-align: center;">Carrito vacío</p>';

            const subtotal = carrito.reduce((sum, item) => sum + (item.precio_por_unidad * item.cantidad), 0);
            const descuento = subtotal * 0.10;
            const total = subtotal - descuento;
            document.getElementById('subtotal-amount').textContent = `S/. ${subtotal.toFixed(2)}`;
            document.getElementById('desc-amount').textContent = `- S/. ${descuento.toFixed(2)}`;
            document.getElementById('total-amount').textContent = `S/. ${total.toFixed(2)}`;
            document.getElementById('cart-btn').textContent = `🛒 (${carrito.length})`;
            document.getElementById('total-section').classList.toggle('active', carrito.length > 0);

            // Barra de progreso hacia el envío gratis (umbral S/ 99)
            const UMBRAL = 99;
            const prog = document.getElementById('envio-progreso');
            if (prog) {
                if (!carrito.length) {
                    prog.style.display = 'none';
                } else {
                    prog.style.display = 'block';
                    const falta = UMBRAL - total;
                    const pct = Math.min(100, (total / UMBRAL) * 100);
                    if (falta <= 0) {
                        prog.className = 'envio-prog free';
                        prog.innerHTML = '<div class="envio-prog-text">🎉 ¡Tu pedido ya tiene envío gratis!</div><div class="envio-prog-bar"><div class="envio-prog-fill" style="width:100%"></div></div>';
                    } else {
                        prog.className = 'envio-prog';
                        prog.innerHTML = `<div class="envio-prog-text">🛵 Te faltan S/. ${falta.toFixed(2)} para el envío gratis</div><div class="envio-prog-bar"><div class="envio-prog-fill" style="width:${pct}%"></div></div>`;
                    }
                }
            }
            renderCrossSell();
            guardarCarrito();
        }

        // Venta cruzada dentro del carrito
        function renderCrossSell() {
            const cont = document.getElementById('cart-cross');
            if (!cont) return;
            if (!carrito.length) { cont.style.display = 'none'; cont.innerHTML = ''; return; }
            const enCarrito = new Set(carrito.map(i => i._k));
            const cats = new Set(carrito.map(i => i.categoria));
            const cand = productos.filter(p => p.cond === 'LIBRE' && p.precio_por_unidad > 0 && !enCarrito.has(p._k));
            const mismos = cand.filter(p => cats.has(p.categoria));
            const pool = (mismos.length >= 3 ? mismos : cand).slice(0, 3);
            if (!pool.length) { cont.style.display = 'none'; cont.innerHTML = ''; return; }
            cont.style.display = 'block';
            cont.innerHTML = '<div class="cc-title">✨ También te puede interesar</div>' +
                pool.map(p => `<div class="cc-item"><span class="cc-name">${p.nombre}</span><span class="cc-price">S/. ${(p.precio_por_unidad * 0.9).toFixed(2)}</span><button class="cc-add" onclick="addCart(${p._k})">+ Agregar</button></div>`).join('');
        }

        function guardarCarrito() {
            try { localStorage.setItem('promedic_carrito', JSON.stringify(carrito)); } catch (e) {}
        }
        function cargarCarrito() {
            try {
                const s = localStorage.getItem('promedic_carrito');
                carrito = s ? (JSON.parse(s) || []) : [];
            } catch (e) { carrito = []; }
        }

        function modCant(idx, change) {
            carrito[idx].cantidad = Math.max(1, carrito[idx].cantidad + parseInt(change));
            if (carrito[idx].cantidad === 0) carrito.splice(idx, 1);
            updateCart();
        }

        function vaciarCarrito() {
            if (carrito.length === 0) {
                alert('El carrito ya está vacío');
                return;
            }
            if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
                carrito = [];
                updateCart();
            }
        }

        function showForm() {
            document.getElementById('form-section').classList.add('active');
        }

        function sendWhatsApp() {
            const name = document.getElementById('client-name').value;
            const phone = document.getElementById('client-phone').value;

            if (!name || !phone) {
                alert('Completa nombre y teléfono');
                return;
            }

            const items = carrito.map(item => {
                const subtotal = item.precio_por_unidad * item.cantidad;
                const formaUnidad = item.formaFarmaceutica.toLowerCase().includes('tableta') ? 'tabletas' :
                                   item.formaFarmaceutica.toLowerCase().includes('cápsula') ? 'cápsulas' :
                                   item.formaFarmaceutica.toLowerCase().includes('jarabe') ? 'frascos' :
                                   item.formaFarmaceutica.toLowerCase().includes('crema') ? 'tubos' : 'unidades';

                return `📌 ${item.nombre}\n├─ Concentración: ${item.concentracion}\n├─ Fabricante: ${item.fabricante}\n├─ Cantidad: ${item.cantidad} ${formaUnidad}\n├─ Precio: S/. ${item.precio_por_unidad.toFixed(2)}/un\n└─ Subtotal: S/. ${subtotal.toFixed(2)}`;
            }).join('\n\n');

            const subtotal = carrito.reduce((sum, item) => sum + (item.precio_por_unidad * item.cantidad), 0);
            const descuento = subtotal * 0.10;
            const total = subtotal - descuento;
            const f = new Date();
            const ordNum = `PM-${String(f.getFullYear()).slice(2)}${String(f.getMonth() + 1).padStart(2, '0')}${String(f.getDate()).padStart(2, '0')}-${String(f.getHours()).padStart(2, '0')}${String(f.getMinutes()).padStart(2, '0')}`;
            const mensaje = `🛒 NUEVO PEDIDO - PROMEDIC\n🧾 Pedido N° ${ordNum}\n\n👤 Cliente: ${name}\n📱 Teléfono: ${phone}\n${document.getElementById('client-email').value ? '📧 Email: ' + document.getElementById('client-email').value + '\n' : ''}\n${items}\n\n💰 Subtotal: S/. ${subtotal.toFixed(2)}\n🎁 Descuento 10% (App): - S/. ${descuento.toFixed(2)}\n✅ TOTAL: S/. ${total.toFixed(2)}\n\n---\nEnviado desde ProMedic App`;

            track('pedido_whatsapp', { valor: +total.toFixed(2), currency: 'PEN', items: carrito.length, pedido: ordNum });

            const url = `https://wa.me/51935896961?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');

            carrito = [];
            updateCart();
            document.getElementById('cart-modal').classList.remove('active');
            document.getElementById('form-section').classList.remove('active');
            document.getElementById('client-name').value = '';
            document.getElementById('client-phone').value = '';
            document.getElementById('client-email').value = '';
            openReview();
        }

        const REVIEW_URL = 'https://g.page/r/CVcJ0bzQOSU9EBM/review';
        function openReview() { document.getElementById('review-modal').classList.add('active'); }
        function closeReview() { document.getElementById('review-modal').classList.remove('active'); }
        function goReview() { window.open(REVIEW_URL, '_blank'); closeReview(); }

        // Condiciones
        function openCond() { document.getElementById('cond-modal').classList.add('active'); }
        function closeCond() { document.getElementById('cond-modal').classList.remove('active'); }

        function closeCart() {
            document.getElementById('cart-modal').classList.remove('active');
            document.getElementById('form-section').classList.remove('active');
        }

        document.getElementById('cart-btn').addEventListener('click', () => {
            document.getElementById('cart-modal').classList.add('active');
        });

        function buscarChip(q, cat) {
            const inp = document.getElementById('search');
            inp.value = q;
            actualizarClear();
            track('buscar', { termino: q, origen: 'chip' });
            // Scope el chip a su categoría (si esa categoría tiene productos); si no, busca en todas.
            categoriaActual = (cat && productos.some(p => p.categoria === cat)) ? cat : 'Todas';
            letraActual = ''; paginaProductos = loteProductos();
            generarBotonesCategorias();
            generarNav();
            renderProducts();
            const dest = document.getElementById('catalogo');
            if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        let searchTrackTimer;
        function actualizarClear() {
            const b = document.getElementById('search-clear');
            if (b) b.classList.toggle('show', !!document.getElementById('search').value);
        }
        // La cabecera cambia de alto segun el ancho: la medimos en vez de fijar un numero.
        function medirFijos() {
            const raiz = document.documentElement;
            const cab = document.querySelector('header');
            const bus = document.getElementById('buscador-top');
            if (cab) raiz.style.setProperty('--alto-header', cab.offsetHeight + 'px');
            if (cab && bus) raiz.style.setProperty('--alto-fijo', (cab.offsetHeight + bus.offsetHeight + 8) + 'px');
        }
        window.addEventListener('load', medirFijos);
        window.addEventListener('resize', medirFijos);

        // Con el buscador arriba, al escribir hay que traer el catalogo a la vista.
        function acercarCatalogo() {
            const inp = document.getElementById('search');
            const dest = document.getElementById('catalogo');
            if (!inp || !dest || !inp.value) return;
            if (dest.getBoundingClientRect().top > window.innerHeight * 0.45) {
                dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function limpiarBusqueda() {
            const inp = document.getElementById('search');
            inp.value = '';
            categoriaActual = productos.some(p => p.categoria === CATEGORIA_INICIAL) ? CATEGORIA_INICIAL : 'Todas';
            letraActual = ''; paginaProductos = loteProductos();
            generarBotonesCategorias(); generarNav(); renderProducts();
            actualizarClear();
            const dest = document.getElementById('catalogo');
            if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
            inp.focus();
        }
        document.getElementById('search').addEventListener('input', () => {
            actualizarClear();
            // El filtro es categoria Y texto: si el catalogo abre en Dermatologicos y
            // alguien escribe "paracetamol", sin esto no encontraria nada.
            if (document.getElementById('search').value.trim() && (categoriaActual !== 'Todas' || letraActual !== '')) {
                categoriaActual = 'Todas'; letraActual = '';
                generarBotonesCategorias(); generarNav();
            }
            paginaProductos = loteProductos(); renderProducts();
            acercarCatalogo();
            clearTimeout(searchTrackTimer);
            searchTrackTimer = setTimeout(() => {
                const q = document.getElementById('search').value.trim();
                if (q.length >= 3) track('buscar', { termino: q, origen: 'texto' });
            }, 1500);
        });
        cargarProductos();
        cargarCarrito();
        updateCart();

        // Ficha de producto
        function fichaZoom(e) {
            if (window.matchMedia('(hover: none)').matches) return; // en móvil se usa el toque para ampliar
            const img = document.getElementById('ficha-main-img');
            if (!img) return;
            const r = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            const y = ((e.clientY - r.top) / r.height) * 100;
            img.style.transformOrigin = x + '% ' + y + '%';
            img.style.transform = 'scale(2.3)';
        }
        function fichaZoomOut() {
            const img = document.getElementById('ficha-main-img');
            if (img) img.style.transform = 'scale(1)';
        }
        function fichaSwap(src, el) {
            const main = document.getElementById('ficha-main-img');
            if (main) { main.src = src; main.style.display = 'block'; }
            document.querySelectorAll('.ficha-thumb').forEach(t => t.classList.remove('active'));
            if (el) el.classList.add('active');
        }
        function openFicha(k) {
            const p = productos[k];
            if (!p) return;
            track('ver_producto', { producto: p.nombre });
            const resolveImg = s => s ? (s.startsWith('http') ? normalizeImg(s) : 'fotos/' + s) : '';
            const imgs = [p.imagen, p.imagen2, p.imagen3].map(x => (x || '').trim()).filter(Boolean).map(resolveImg);
            const conc = (p.concentracion || '').trim();
            const tieneConc = conc && conc.toUpperCase() !== 'N/A';
            let imgBlock;
            if (imgs.length) {
                const thumbs = imgs.length > 1
                    ? `<div class="ficha-thumbs">${imgs.map((s, i) => `<img src="${s}" alt="${p.nombre}" class="ficha-thumb${i === 0 ? ' active' : ''}" onclick="fichaSwap('${s}', this)" />`).join('')}</div>`
                    : '';
                imgBlock = `<div class="ficha-zoom" onmousemove="fichaZoom(event)" onmouseleave="fichaZoomOut()"><img id="ficha-main-img" src="${imgs[0]}" alt="${p.nombre}" class="ficha-img" onclick="openImg(this.src, this.alt)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="ficha-img ficha-img-empty" style="display:none;">${formIcon(p.formaFarmaceutica)}</div></div>${thumbs}`;
            } else {
                imgBlock = `<div class="ficha-img ficha-img-empty">${formIcon(p.formaFarmaceutica)}</div>`;
            }
            const esReceta = p.cond === 'RECETA';
            const recetaBadge = esReceta ? `<div class="ficha-receta">⚠️ Requiere receta médica</div>` : '';
            const descBlock = p.descripcion ? `<div class="ficha-sec"><h4>¿Para qué sirve?</h4><p>${p.descripcion}</p></div>` : '';
            const usoBlock = p.uso ? `<div class="ficha-sec"><h4>Modo de uso</h4><p>${p.uso}</p></div>` : '';
            const advBlock = p.advertencias ? `<div class="ficha-warn"><h4>⚠️ Advertencias</h4><p>${p.advertencias}</p></div>` : '';
            const consultaMsg = `Hola, quiero información sobre el producto: ${p.nombre}${tieneConc ? ' ' + conc : ''}`;
            const waUrl = `https://wa.me/51935896961?text=${encodeURIComponent(consultaMsg)}`;

            const relacionados = productos.filter(x => x.categoria === p.categoria && x._k !== p._k).sort(() => Math.random() - 0.5).slice(0, 4);
            let relHtml = '';
            if (relacionados.length) {
                relHtml = '<div class="ficha-rel"><h4>También te puede interesar</h4><div class="ficha-rel-grid">' +
                    relacionados.map(r => {
                        const rImg = r.imagen ? imgThumb(r.imagen.startsWith('http') ? normalizeImg(r.imagen) : 'fotos/' + r.imagen, 'm') : '';
                        const rThumb = rImg
                            ? `<img src="${rImg}" alt="${r.nombre}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="rel-thumb-icon" style="display:none;">${formIcon(r.formaFarmaceutica)}</div>`
                            : `<div class="rel-thumb-icon">${formIcon(r.formaFarmaceutica)}</div>`;
                        const rPrecio = r.precio_por_unidad > 0 ? 'S/. ' + (r.precio_por_unidad * 0.9).toFixed(2) : '';
                        return `<div class="ficha-rel-card" onclick="openFicha(${r._k})"><div class="rel-thumb">${rThumb}</div><div class="rel-name">${r.nombre}</div><div class="rel-price">${rPrecio}</div></div>`;
                    }).join('') + '</div></div>';
            }

            document.getElementById('ficha-content').innerHTML = `
                <button class="ficha-close" onclick="closeFicha()" aria-label="Cerrar">&times;</button>
                ${imgBlock}
                ${p.formaFarmaceutica ? `<div class="ficha-pres">${p.formaFarmaceutica}</div>` : ''}
                <h2 class="ficha-name">${p.nombre}</h2>
                ${p.fabricante ? `<div class="ficha-brand">${p.fabricante}</div>` : ''}
                ${recetaBadge}
                ${p.precio_por_unidad > 0
                    ? `<div class="ficha-price"><span class="ficha-price-old">S/. ${p.precio_por_unidad.toFixed(2)}</span>S/. ${(p.precio_por_unidad * 0.9).toFixed(2)} <span class="ficha-off">-10% App</span></div>`
                    : `<div class="ficha-price">S/. ${p.precio_por_unidad.toFixed(2)} <span>por unidad</span></div>`}
                <div class="ficha-meta">
                    ${p.principio ? `<div class="ficha-row"><span>Principio activo</span><b>${p.principio}</b></div>` : ''}
                    ${tieneConc ? `<div class="ficha-row"><span>Concentración</span><b>${conc}</b></div>` : ''}
                    <div class="ficha-row"><span>Stock disponible</span><b>${p.stock_unidades} un.</b></div>
                </div>
                ${descBlock}
                ${usoBlock}
                ${advBlock}
                <div class="ficha-actions">
                    ${esReceta
                        ? `<button class="btn ficha-rx" onclick="solicitarReceta(${p._k}); closeFicha();">📋 Solicitar con receta</button>`
                        : `<button class="btn" onclick="addCart(${p._k}); closeFicha();">🛒 Agregar al carrito</button>`}
                    <a class="btn ficha-key" href="${waUrl}" target="_blank" rel="noopener">💬 Preguntar a la Dra. Key</a>
                </div>
                <button class="ficha-subs" onclick="suscribirProducto(${p._k})">🔁 Recíbelo cada mes · recompra automática por WhatsApp</button>
                ${relHtml}
            `;
            document.getElementById('ficha-modal').classList.add('active');
        }
        function closeFicha() {
            document.getElementById('ficha-modal').classList.remove('active');
        }
        function suscribirProducto(k) {
            const p = productos[k];
            if (!p) return;
            track('suscripcion', { producto: p.nombre });
            const conc = (p.concentracion || '').trim();
            const tieneConc = conc && conc.toUpperCase() !== 'N/A';
            const msg = `Hola, quiero *suscribirme* para recibir cada mes: ${p.nombre}${tieneConc ? ' ' + conc : ''}. Por favor recuérdenme y coordinamos la recompra mensual. 🔁`;
            window.open(`https://wa.me/51935896961?text=${encodeURIComponent(msg)}`, '_blank');
        }
        function joinClub() {
            track('club_inscripcion');
            const msg = '¡Hola! Quiero unirme al *Club ProMedic* para acumular puntos con mis compras y recibir mi bono de bienvenida de 50 puntos. 🎁';
            window.open(`https://wa.me/51935896961?text=${encodeURIComponent(msg)}`, '_blank');
        }
        function openClubModal() { renderCupones(); document.getElementById('club-modal').classList.add('active'); }
        function closeClubModal() { document.getElementById('club-modal').classList.remove('active'); }
        function referir() {
            track('referir');
            const name = (document.getElementById('refer-name').value || '').trim();
            const quien = name || 'un amigo';
            const link = 'https://promedic-farma.vercel.app';
            const msg = `¡Te recomiendo *ProMedic Amazonas*! 💊 Medicinas, dermatológicos y vitaminas con delivery en Rodríguez de Mendoza.\n\nÚnete al *Club ProMedic* y ganamos los dos: tú un descuento de bienvenida y yo puntos. 🎁\n\n👉 ${link}\n\nCuando hagas tu primera compra, menciona que te recomendó: ${quien}.`;
            window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
        }

        // === RULETA DE PREMIOS (edita este arreglo: label corto, code, color, premio true/false, peso=probabilidad) ===
        let premios = [
            { label: 'S/ 5 dscto', code: 'RUL-5', color: '#1565c0', premio: true, peso: 12 },
            { label: 'Delivery gratis', code: 'RUL-DELIV', color: '#5daa28', premio: true, peso: 10 },
            { label: '10 puntos Club', code: 'RUL-10PTS', color: '#1e78d6', premio: true, peso: 16 },
            { label: 'Sigue participando', code: '', color: '#94a3b8', premio: false, peso: 22 },
            { label: 'Muestra de regalo', code: 'RUL-MUESTRA', color: '#f59e0b', premio: true, peso: 10 },
            { label: '5% extra', code: 'RUL-5PCT', color: '#0f4c9a', premio: true, peso: 12 },
            { label: 'Casi... reintenta', code: '', color: '#cbd5e1', premio: false, peso: 14 },
            { label: 'S/ 10 dscto', code: 'RUL-10', color: '#db2777', premio: true, peso: 4 }
        ];
        let ruletaRot = 0;
        let ruletaGirando = false;
        function hoyStr() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
        // El codigo lleva la fecha del dia: asi el mostrador ve de un vistazo si vencio (RUL-5 -> RUL-5-0408)
        function codigoDelDia(code) { const d = new Date(); return code + '-' + String(d.getDate()).padStart(2,'0') + String(d.getMonth()+1).padStart(2,'0'); }
        function yaGiroHoy() { try { return localStorage.getItem('promedic_ruleta_fecha') === hoyStr(); } catch(e) { return false; } }
        function buildRuleta() {
            const n = premios.length, seg = 360 / n, cx = 100, cy = 100, R = 98;
            let s = '';
            premios.forEach((p, i) => {
                const a0 = (i*seg - 90) * Math.PI/180, a1 = ((i+1)*seg - 90) * Math.PI/180;
                const x0 = cx + R*Math.cos(a0), y0 = cy + R*Math.sin(a0);
                const x1 = cx + R*Math.cos(a1), y1 = cy + R*Math.sin(a1);
                s += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0,1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${p.color}" stroke="#ffffff" stroke-width="1.2"/>`;
                const am = ((i+0.5)*seg - 90) * Math.PI/180;
                const lx = cx + (R*0.60)*Math.cos(am), ly = cy + (R*0.60)*Math.sin(am);
                const rot = (i+0.5)*seg;
                const words = p.label.split(' ');
                let lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length/2)).join(' '), words.slice(Math.ceil(words.length/2)).join(' ')] : [p.label];
                const tspans = lines.map((ln, k) => `<tspan x="0" dy="${k === 0 ? (lines.length>1?-3:0) : 8}">${ln}</tspan>`).join('');
                s += `<g transform="translate(${lx.toFixed(2)},${ly.toFixed(2)}) rotate(${rot})"><text text-anchor="middle" font-size="6.5" font-weight="800" fill="#ffffff">${tspans}</text></g>`;
            });
            document.getElementById('ruleta-wheel').innerHTML = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="display:block;border-radius:50%;border:8px solid #0f2a4a;box-sizing:border-box;">${s}</svg>`;
        }
        // La banda no desaparece cuando ya se giro: se apaga y avisa que vuelva
        // manana. Si desaparece, quien entra por la tarde ni se entera del juego.
        function actualizarBandaRuleta() {
            const b = document.getElementById('ruleta-banda');
            if (!b) return;
            const yaGiro = yaGiroHoy();
            b.style.display = 'flex';
            b.classList.toggle('usada', yaGiro);
            const txt = b.querySelector('.rb-txt');
            const cta = b.querySelector('.rb-cta');
            if (txt) txt.innerHTML = yaGiro
                ? '<b>Ya giraste hoy</b><small>Vuelve mañana por otro giro gratis</small>'
                : '<b>Gira y gana</b><small>Un giro gratis al día · el premio vale solo hoy</small>';
            if (cta) cta.innerHTML = yaGiro ? 'Mañana' : 'Girar &rsaquo;';
        }
        window.addEventListener('load', actualizarBandaRuleta);

        function openRuleta() {
            buildRuleta();
            const btn = document.getElementById('ruleta-girar');
            const res = document.getElementById('ruleta-result');
            res.style.display = 'none';
            if (yaGiroHoy()) { btn.disabled = true; btn.textContent = 'Ya giraste hoy · vuelve mañana'; }
            else { btn.disabled = false; btn.textContent = '¡Girar!'; }
            document.getElementById('ruleta-modal').classList.add('active');
        }
        function closeRuleta() { document.getElementById('ruleta-modal').classList.remove('active'); }
        function pickPremio() {
            const total = premios.reduce((a, p) => a + (p.peso || 1), 0);
            let r = Math.random() * total;
            for (let i = 0; i < premios.length; i++) { r -= (premios[i].peso || 1); if (r < 0) return i; }
            return premios.length - 1;
        }
        function girarRuleta() {
            if (ruletaGirando || yaGiroHoy()) return;
            ruletaGirando = true;
            const btn = document.getElementById('ruleta-girar');
            btn.disabled = true; btn.textContent = 'Girando...';
            document.getElementById('ruleta-result').style.display = 'none';
            const n = premios.length, seg = 360 / n;
            const idx = pickPremio();
            const jitter = (Math.random() - 0.5) * (seg * 0.6);
            ruletaRot += 360*6 - ((idx + 0.5) * seg) - (ruletaRot % 360) + jitter;
            document.getElementById('ruleta-wheel').style.transform = `rotate(${ruletaRot}deg)`;
            track('ruleta_giro', { premio: premios[idx].label });
            try { localStorage.setItem('promedic_ruleta_fecha', hoyStr()); } catch(e) {}
            actualizarBandaRuleta();
            setTimeout(() => {
                ruletaGirando = false;
                mostrarPremio(idx);
                btn.textContent = 'Ya giraste hoy · vuelve mañana';
            }, 4700);
        }
        function mostrarPremio(idx) {
            const p = premios[idx];
            const res = document.getElementById('ruleta-result');
            res.style.display = 'block';
            if (p.premio) {
                res.classList.remove('lose');
                res.innerHTML = `<b>🎉 ¡Ganaste: ${p.label}!</b><p>Código <b style="display:inline">${codigoDelDia(p.code)}</b> · <b style="display:inline;color:#b45309">vence hoy a medianoche</b>.<br>Válido en <b style="display:inline">una sola compra de hoy</b> desde S/ 99. <b style="display:inline">No es acumulable</b> con otros premios ni con el 10% de la App.</p><button class="btn" style="width:100%;background:#25D366;box-shadow:0 2px 6px rgba(37,211,102,.3);" onclick="reclamarPremio('${p.label.replace(/'/g,"")}','${codigoDelDia(p.code)}')">📲 Reclamar por WhatsApp</button>`;
            } else {
                res.classList.add('lose');
                res.innerHTML = `<b>¡Casi! 🙂</b><p>Hoy no salió premio, pero mañana tienes otro giro. ¡Vuelve!</p>`;
            }
        }
        function reclamarPremio(label, code) {
            track('ruleta_reclamo', { premio: label });
            const msg = `¡Hola ProMedic! 🎡 Gané en la Ruleta de premios: *${label}* (código ${code}). Entiendo que es válido solo para una compra de hoy, en un solo pedido, y que no es acumulable con otros premios ni con el 10% de la App.`;
            window.open('https://wa.me/51935896961?text=' + encodeURIComponent(msg), '_blank');
        }

        // === Carrusel "Elegidos para ti" (se alimenta de la columna 'destacado' del Sheet) ===
        function renderDestacados() {
            const card = document.getElementById('destacados-card');
            const row = document.getElementById('destacados-row');
            if (!card || !row) return;
            const dest = productos.filter(p => p.destacado > 0).sort((a, b) => a.destacado - b.destacado);
            if (!dest.length) { card.style.display = 'none'; return; }
            row.innerHTML = dest.map(p => {
                const destImgs = [p.imagen, p.imagen2, p.imagen3].map(x => (x || '').trim()).filter(Boolean).map(s => imgThumb(s.startsWith('http') ? normalizeImg(s) : 'fotos/' + s, 'l'));
                const imgSrc = destImgs[0] || '';
                const dmulti = destImgs.length > 1;
                const icon = formIcon(p.formaFarmaceutica);
                const img = imgSrc
                    ? `<img src="${imgSrc}" alt="${p.nombre}" loading="lazy" class="dest-img${dmulti ? ' pc-rot' : ''}"${dmulti ? ` data-imgs="${destImgs.join('|')}"` : ''} onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="dest-img-empty" style="display:none;">${icon}</div>`
                    : `<div class="dest-img-empty">${icon}</div>`;
                const precio = p.precio_por_unidad > 0
                    ? `<div class="dest-price-old">S/. ${p.precio_por_unidad.toFixed(2)}</div><div class="dest-price">S/. ${(p.precio_por_unidad*0.9).toFixed(2)}<span class="dest-off">-10%</span></div>`
                    : `<div class="dest-price">Consultar</div>`;
                return `<div class="dest-card" onclick="openFicha(${p._k})">
                    ${img}
                    <div class="dest-name">${p.nombre}</div>
                    <div class="dest-price-wrap">${precio}</div>
                    <button class="dest-btn" onclick="event.stopPropagation(); addCart(${p._k})">Agregar</button>
                </div>`;
            }).join('');
            card.style.display = 'block';
            iniciarCarruselDestacados(row);
        }
        let destTimer = null;
        function iniciarCarruselDestacados(row) {
            if (destTimer) { clearInterval(destTimer); destTimer = null; }
            const cards = row.querySelectorAll('.dest-card');
            if (cards.length < 2) return;
            let pausado = false;
            const paso = () => (cards[0].offsetWidth + 12);
            const pausaBreve = () => { pausado = true; clearTimeout(row._resume); row._resume = setTimeout(() => { pausado = false; }, 4000); };
            row.addEventListener('touchstart', pausaBreve, { passive: true });
            row.addEventListener('mouseenter', () => { pausado = true; });
            row.addEventListener('mouseleave', () => { pausado = false; });
            destTimer = setInterval(() => {
                if (pausado || document.hidden) return;
                if (row.scrollWidth - row.clientWidth <= 4) return; // no hay overflow, nada que rotar
                if (row.scrollLeft + row.clientWidth >= row.scrollWidth - 4) {
                    row.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    row.scrollBy({ left: paso(), behavior: 'smooth' });
                }
            }, 3000);
        }
        function verMasDestacados() {
            const dest = document.getElementById('catalogo');
            if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // === Mi Piel · Corner Dra. Key ===
        function openLibroModal() { track('libro_reclamaciones'); document.getElementById('libro-modal').classList.add('active'); }
        function closeLibroModal() { document.getElementById('libro-modal').classList.remove('active'); }
        function openMiPiel() { track('mipiel_abrir'); document.getElementById('mipiel-modal').classList.add('active'); }
        function closeMiPiel() { document.getElementById('mipiel-modal').classList.remove('active'); }
        function planPiel() {
            track('mipiel_plan');
            const msg = '¡Hola Dra. Key! 🌸 Me hice un tratamiento estético con ustedes y quiero mi *plan personalizado de cuidado de la piel* para mantener mis resultados. ¿Me lo pueden armar?';
            window.open('https://wa.me/51935896961?text=' + encodeURIComponent(msg), '_blank');
        }
        function agendarMantenimiento() {
            track('mipiel_mantenimiento');
            const msg = '¡Hola! 🗓️ Quiero agendar mi *control/mantenimiento de estética* con la Dra. Key para cuidar mis resultados. ¿Qué disponibilidad hay?';
            window.open('https://wa.me/51935896961?text=' + encodeURIComponent(msg), '_blank');
        }
        function verProductosPiel() { closeMiPiel(); navCat('Dermatológicos'); }

        // ===== HIGIENE ÍNTIMA (selector con compuerta de seguridad) =====
        const intimoPreguntas = [
            { t: '¿En qué etapa te encuentras?', o: [
                { l: 'Edad reproductiva (con regla)', v: 'ph38' },
                { l: 'Embarazo o posparto', v: 'ph68' },
                { l: 'Menopausia', v: 'ph68' } ] },
            { t: '¿Sientes que tu zona íntima es sensible o se irrita con facilidad?', o: [
                { l: 'Sí, es sensible', v: 'sens' },
                { l: 'No, la tolero bien', v: 'nosens' } ] },
            { t: '¿Para qué lo necesitas principalmente?', o: [
                { l: 'Higiene diaria en casa', v: 'diario' },
                { l: 'Deporte o días muy activos', v: 'activo' },
                { l: 'Viajes o fuera de casa', v: 'viaje' } ] },
            { t: '¿Tienes alguna molestia ahora? (picazón, ardor, flujo distinto o mal olor)', o: [
                { l: 'No, ninguna molestia', v: 'nomol' },
                { l: 'Sí, tengo alguna molestia', v: 'molestia' } ] }
        ];
        let intimoIdx = 0, intimoPh = 'ph38', intimoSens = false, intimoUso = 'diario', intimoMolestia = false;
        function openTestIntimo() {
            track('intimo_iniciar');
            intimoIdx = 0; intimoPh = 'ph38'; intimoSens = false; intimoUso = 'diario'; intimoMolestia = false;
            renderIntimoPregunta();
            document.getElementById('intimo-modal').classList.add('active');
        }
        function closeIntimo() { document.getElementById('intimo-modal').classList.remove('active'); }
        function renderIntimoPregunta() {
            const q = intimoPreguntas[intimoIdx];
            document.getElementById('intimo-body').innerHTML =
                `<div class="test-progress">Pregunta ${intimoIdx + 1} de ${intimoPreguntas.length}</div>
                 <div class="test-q">${q.t}</div>` +
                q.o.map(op => `<button class="test-opt" onclick="responderIntimo('${op.v}')">${op.l}</button>`).join('');
        }
        function responderIntimo(v) {
            if (v === 'ph38' || v === 'ph68') intimoPh = v;
            else if (v === 'sens') intimoSens = true;
            else if (v === 'nosens') intimoSens = false;
            else if (v === 'diario' || v === 'activo' || v === 'viaje') intimoUso = v;
            else if (v === 'molestia') intimoMolestia = true;
            intimoIdx++;
            if (intimoIdx < intimoPreguntas.length) renderIntimoPregunta();
            else mostrarResultadoIntimo();
        }
        function consultaIntima() {
            track('intimo_consulta');
            const msg = 'Hola Dra. Key, quisiera una *consulta privada sobre salud íntima*. ¿Qué disponibilidad hay? Gracias.';
            window.open('https://wa.me/51935896961?text=' + encodeURIComponent(msg), '_blank');
        }
        function productosIntimos(ph, sens, uso) {
            const kw = ['intimo', 'intima', 'femenino'];
            const pool = productos.filter(p => { const hay = p._busq || ''; return p.precio_por_unidad > 0 && kw.some(w => hay.includes(w)); });
            const phTag = ph === 'ph38' ? '3.8' : '6.8';
            const otherTag = ph === 'ph38' ? '6.8' : '3.8';
            const score = p => {
                const hay = p._busq || ''; let s = 0;
                if (hay.includes(phTag)) s += 3;
                if (hay.includes(otherTag)) s -= 2;
                if (sens && (hay.includes('sensible') || hay.includes('sensitive'))) s += 1;
                if ((uso === 'viaje' || uso === 'activo') && (hay.includes('toallita') || hay.includes('wipe'))) s += 1;
                return s;
            };
            return pool.slice().sort((a, b) => score(b) - score(a)).slice(0, 6);
        }
        function mostrarResultadoIntimo() {
            const body = document.getElementById('intimo-body');
            if (intimoMolestia) {
                track('intimo_derivacion');
                body.innerHTML =
                    `<div class="test-progress">Recomendación</div>
                     <div class="test-result-tipo">🩺 Mejor te ve la Dra. Key</div>
                     <div class="test-result-desc">Una molestia íntima (picazón, ardor, flujo distinto o mal olor) merece una <b>evaluación profesional</b>, no solo un producto. La Dra. Key te atiende de forma <b>privada, confidencial y sin vergüenza</b>, con un diagnóstico preciso y el tratamiento correcto.</div>
                     <div class="test-tip">🔒 Tu salud íntima es delicada y tu privacidad está protegida. Este test no guarda ninguna respuesta.</div>
                     <button class="mp-cta mp-agenda" onclick="closeIntimo(); consultaIntima();">💬 Consultar en privado con la Dra. Key</button>
                     <button class="btn" onclick="openTestIntimo()" style="width:100%; background:#eff6ff; color:#1565c0; box-shadow:none;">↺ Volver a empezar</button>`;
                return;
            }
            track('intimo_resultado', { ph: intimoPh, uso: intimoUso, sensible: intimoSens });
            const phLabel = intimoPh === 'ph38' ? 'pH ácido (≈ 3.8)' : 'pH suave (≈ 6.8)';
            const phDesc = intimoPh === 'ph38'
                ? 'En edad reproductiva tu zona íntima es naturalmente ácida. Un limpiador con pH cercano a 3.8 respeta tu flora y ayuda a prevenir molestias.'
                : 'En embarazo, posparto o menopausia conviene un pH más suave (≈ 6.8), acorde a los cambios de esta etapa.';
            const prods = productosIntimos(intimoPh, intimoSens, intimoUso);
            let grid;
            if (prods.length) {
                grid = '<div class="test-prod-grid">' + prods.map(p => {
                    const img = p.imagen ? (p.imagen.startsWith('http') ? normalizeImg(p.imagen) : 'fotos/' + p.imagen) : '';
                    const imgHtml = img
                        ? `<img src="${img}" alt="${p.nombre}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="tp-empty" style="display:none;">${formIcon(p.formaFarmaceutica)}</div>`
                        : `<div class="tp-empty">${formIcon(p.formaFarmaceutica)}</div>`;
                    return `<div class="test-prod" onclick="closeIntimo(); openFicha(${p._k})">
                        ${imgHtml}
                        <div class="tp-name">${p.nombre}</div>
                        <div class="tp-price">S/ ${(p.precio_por_unidad * 0.9).toFixed(2)}</div>
                        <button class="tp-btn" onclick="event.stopPropagation(); addCart(${p._k})">Agregar</button>
                    </div>`;
                }).join('') + '</div>';
            } else {
                grid = `<p style="font-size:12.5px;color:#6b7280;margin-bottom:12px;">Pronto tendremos más productos de esta línea. Mientras tanto, la Dra. Key puede recomendarte el ideal para ti.</p>`;
            }
            body.innerHTML =
                `<div class="test-progress">Tu resultado</div>
                 <div class="test-result-tipo">🌷 ${phLabel}</div>
                 <div class="test-result-desc">${phDesc}${intimoSens ? ' Como tu piel es sensible, elige fórmulas sin fragancia y calmantes.' : ''}</div>
                 <div class="test-tip">💡 Ante cualquier molestia (picazón, ardor, flujo distinto o mal olor), no te automediques: consulta a la Dra. Key.</div>
                 <h4 class="club-sec-title">✨ Recomendado para ti</h4>
                 ${grid}
                 <button class="mp-cta mp-agenda" onclick="closeIntimo(); consultaIntima();">🩺 Consulta privada con la Dra. Key</button>
                 <button class="btn" onclick="openTestIntimo()" style="width:100%; background:#eff6ff; color:#1565c0; box-shadow:none;">↺ Repetir</button>
                 <p style="font-size:10.5px;color:#94a3b8;margin-top:10px;text-align:center;">Este selector es orientativo y no reemplaza una evaluación médica.</p>`;
        }

        // ===== TEST DE PIEL =====
        const testPreguntas = [
            { t: 'Unas horas después de lavarte la cara, ¿cómo la sientes?', o: [
                { l: 'Brillosa o grasosa en toda la cara', v: 'grasa' },
                { l: 'Tirante, áspera o con descamación', v: 'seca' },
                { l: 'Brillosa solo en frente y nariz', v: 'mixta' },
                { l: 'Cómoda, ni grasa ni tirante', v: 'normal' } ] },
            { t: '¿Cómo se ven tus poros?', o: [
                { l: 'Grandes y visibles en toda la cara', v: 'grasa' },
                { l: 'Casi no se notan', v: 'seca' },
                { l: 'Grandes solo en la zona T (frente y nariz)', v: 'mixta' },
                { l: 'Normales', v: 'normal' } ] },
            { t: '¿Con qué frecuencia tienes brillo durante el día?', o: [
                { l: 'Todo el día, en toda la cara', v: 'grasa' },
                { l: 'Casi nunca; más bien resequedad', v: 'seca' },
                { l: 'Solo en la zona T', v: 'mixta' },
                { l: 'Rara vez', v: 'normal' } ] },
            { t: '¿Tu piel se irrita, enrojece o pica con facilidad (productos, sol, clima)?', o: [
                { l: 'Sí, con frecuencia', v: 'sens2' },
                { l: 'A veces', v: 'sens1' },
                { l: 'No, la tolero bien', v: 'sens0' } ] },
            { t: '¿Cuál es tu principal preocupación?', o: [
                { l: 'Manchas o melasma', v: 'c_manchas' },
                { l: 'Granitos, acné o imperfecciones', v: 'c_acne' },
                { l: 'Arrugas, líneas o antiedad', v: 'c_arrugas' },
                { l: 'Ninguna; solo mantener mi piel', v: 'c_ninguna' } ] }
        ];
        const tipoInfo = {
            grasa:  { emoji: '💧', label: 'grasa',  desc: 'Produce más sebo, con brillo y poros visibles. Necesita limpieza suave, control de grasa (matificantes) y protección solar ligera (oil-free).' },
            seca:   { emoji: '🌵', label: 'seca',   desc: 'Tiende a la tirantez y descamación. Pide hidratación y nutrición constante, y limpiadores muy suaves.' },
            mixta:  { emoji: '🌗', label: 'mixta',  desc: 'Zona T grasa y mejillas normales o secas. La clave es equilibrar: controlar grasa en la T e hidratar las mejillas.' },
            normal: { emoji: '🌸', label: 'normal', desc: 'Equilibrada y sin grandes problemas. Mantenla con limpieza suave, hidratación y protección solar diaria.' }
        };
        const concernInfo = {
            c_manchas: 'Para las manchas: usa despigmentantes y, sobre todo, protector solar alto TODOS los días (es lo más importante).',
            c_acne:    'Para el acné e imperfecciones: activos purificantes (ácido salicílico, niacinamida) y productos no comedogénicos.',
            c_arrugas: 'Para el antiedad: retinol o retinal en la noche, vitamina C en el día y protección solar constante.',
            c_ninguna: 'Mantén una rutina simple y constante: limpia, hidrata y protege del sol cada día.'
        };
        const pielKeywords = {
            grasa:  'effaclar matificante seborreic purificant oily grasa foaming imperfeccion',
            seca:   'nutratopic nutradeica hidratante hydrating cerave ureadin micelar seca hialuronic sensitive lipikar',
            mixta:  'effaclar mixta micelar hidratante fusion foaming',
            normal: 'hidratante micelar cerave anthelios fusion termal'
        };
        const concernKeywords = {
            c_manchas: 'mela glicoisdin fotoultra unify spot uvmune antimanchas despigment flavo pigment',
            c_acne:    'effaclar acne imperfeccion purifying salicilic foaming duo',
            c_arrugas: 'retinol retinal antiedad anti-age correct flavo hialuronic hyaluronic isdinceutics hyalu',
            c_ninguna: 'micelar hidratante cerave anthelios fusion termal'
        };
        // Productos NO faciales que hay en la categoría dermo (se excluyen del test)
        const excluirNoFacial = ['baby','bebe','panal','pediatric','johnson','repelente','body','corporal','antiestria','podos','manos','intimo','intima','champu','shampoo','labial','locion','spray','avena','bano'];
        let testIdx = 0, testScore = {}, testSens = 0, testConcern = 'c_ninguna';
        function openTest() {
            track('test_piel_iniciar');
            testIdx = 0; testScore = { grasa: 0, seca: 0, mixta: 0, normal: 0 }; testSens = 0; testConcern = 'c_ninguna';
            renderTestPregunta();
            document.getElementById('test-modal').classList.add('active');
        }
        function closeTest() { document.getElementById('test-modal').classList.remove('active'); }
        function renderTestPregunta() {
            const q = testPreguntas[testIdx];
            document.getElementById('test-body').innerHTML =
                `<div class="test-progress">Pregunta ${testIdx + 1} de ${testPreguntas.length}</div>
                 <div class="test-q">${q.t}</div>` +
                q.o.map(op => `<button class="test-opt" onclick="responderTest('${op.v}')">${op.l}</button>`).join('');
        }
        function responderTest(v) {
            if (testScore[v] !== undefined) testScore[v]++;
            else if (v === 'sens2') testSens += 2;
            else if (v === 'sens1') testSens += 1;
            else if (v.startsWith('c_')) testConcern = v;
            testIdx++;
            if (testIdx < testPreguntas.length) renderTestPregunta();
            else mostrarResultadoTest();
        }
        function productosParaPiel(tipo, concern, sensible) {
            const split = s => (s || '').split(' ').filter(w => w.length >= 3);
            const cKw = split(concernKeywords[concern]);
            const tKw = split(pielKeywords[tipo]).concat(sensible ? ['sensible', 'calmante', 'toleriane', 'cicaplast', 'tolerance'] : []);
            // Solo faciales: dermo con precio, excluyendo corporales, bebé, pies, íntimos, etc.
            const pool = productos.filter(p => {
                if (p.categoria !== 'Dermatológicos' || p.precio_por_unidad <= 0) return false;
                const hay = p._busq || '';
                return !excluirNoFacial.some(w => hay.includes(w));
            });
            const match = (p, kws) => { const hay = p._busq || ''; return kws.some(w => hay.includes(w)); };
            const out = [];
            const push = arr => arr.forEach(p => { if (!out.includes(p)) out.push(p); });
            push(pool.filter(p => match(p, cKw)).slice(0, 5));  // la preocupación manda (máx 5)
            push(pool.filter(p => match(p, tKw)));               // luego según el tipo de piel
            return out.slice(0, 8);
        }
        function mostrarResultadoTest() {
            let tipo = 'normal', max = -1;
            for (const k in testScore) { if (testScore[k] > max) { max = testScore[k]; tipo = k; } }
            const sensible = testSens >= 2;
            const info = tipoInfo[tipo];
            track('test_piel_resultado', { tipo: tipo + (sensible ? '-sensible' : ''), preocupacion: testConcern });
            const prods = productosParaPiel(tipo, testConcern, sensible);
            let grid;
            if (prods.length) {
                grid = '<div class="test-prod-grid">' + prods.map(p => {
                    const img = p.imagen ? (p.imagen.startsWith('http') ? normalizeImg(p.imagen) : 'fotos/' + p.imagen) : '';
                    const imgHtml = img
                        ? `<img src="${img}" alt="${p.nombre}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="tp-empty" style="display:none;">${formIcon(p.formaFarmaceutica)}</div>`
                        : `<div class="tp-empty">${formIcon(p.formaFarmaceutica)}</div>`;
                    return `<div class="test-prod" onclick="closeTest(); openFicha(${p._k})">
                        ${imgHtml}
                        <div class="tp-name">${p.nombre}</div>
                        <div class="tp-price">S/ ${(p.precio_por_unidad * 0.9).toFixed(2)}</div>
                        <button class="tp-btn" onclick="event.stopPropagation(); addCart(${p._k})">Agregar</button>
                    </div>`;
                }).join('') + '</div>';
            } else {
                grid = `<p style="font-size:12.5px;color:#6b7280;margin-bottom:12px;">Aún no tenemos productos cargados para esta recomendación. Escríbenos y la Dra. Key te arma tu rutina.</p>`;
            }
            document.getElementById('test-body').innerHTML =
                `<div class="test-progress">Tu resultado</div>
                 <div class="test-result-tipo">${info.emoji} Piel ${info.label}${sensible ? ' · sensible' : ''}</div>
                 <div class="test-result-desc">${info.desc}${sensible ? ' Además tu piel es sensible: prefiere productos calmantes, sin fragancia y para piel sensible.' : ''}</div>
                 <div class="test-tip">💡 ${concernInfo[testConcern]}</div>
                 <h4 class="club-sec-title">✨ Productos recomendados para ti</h4>
                 ${grid}
                 <button class="mp-cta mp-agenda" onclick="closeTest(); openConsultaModal();">🩺 Rutina personalizada con la Dra. Key</button>
                 <button class="btn" onclick="openTest()" style="width:100%; background:#eff6ff; color:#1565c0; box-shadow:none;">↺ Repetir el test</button>
                 <p style="font-size:10.5px;color:#94a3b8;margin-top:10px;text-align:center;">Este test es orientativo y no reemplaza una evaluación profesional.</p>`;
        }

        // === Cupones del Club (edita este arreglo para cambiar/agregar cupones) ===
        let cupones = [
            { codigo: 'BIENVENIDA', titulo: 'S/ 10 de descuento', desc: 'En tu 1ª compra desde S/ 99. Se suma al 10% de la app · un solo uso.', icono: '🎁' },
            { codigo: 'CLUB', titulo: 'S/ 10 de descuento', desc: 'En compras desde S/ 99. Se suma al 10% de la app · un solo uso.', icono: '⭐' }
        ];
        function renderCupones() {
            const el = document.getElementById('cupones-cont');
            if (!el) return;
            if (!cupones.length) { el.innerHTML = '<p style="font-size:12px;color:#6b7280;">Pronto tendremos cupones nuevos. 👀</p>'; return; }
            el.innerHTML = cupones.map((c, i) => `
                <div class="cupon" onclick="usarCupon(${i})">
                    <span class="cupon-ico">${c.icono}</span>
                    <div class="cupon-body"><b>${c.titulo}</b><small>${c.desc}</small></div>
                    <span class="cupon-code" id="cupcode-${i}">${c.codigo}</span>
                </div>`).join('');
        }
        function usarCupon(i) {
            const c = cupones[i];
            if (!c) return;
            track('usar_cupon', { codigo: c.codigo });
            if (navigator.clipboard) { navigator.clipboard.writeText(c.codigo).catch(() => {}); }
            const tag = document.getElementById('cupcode-' + i);
            if (tag) {
                tag.textContent = '¡Copiado!';
                tag.classList.add('cupon-copiado');
                setTimeout(() => { tag.textContent = c.codigo; tag.classList.remove('cupon-copiado'); }, 1600);
            }
            const msg = `¡Hola ProMedic! 👋 Quiero usar mi cupón *${c.codigo}* (${c.titulo}) del Club ProMedic en mi pedido.`;
            window.open('https://wa.me/51935896961?text=' + encodeURIComponent(msg), '_blank');
        }

        // Ampliar imagen del producto
        function openImg(src, alt) {
            document.getElementById('img-modal-img').src = src;
            document.getElementById('img-modal-img').alt = alt || '';
            document.getElementById('img-modal-caption').textContent = alt || '';
            document.getElementById('img-modal').classList.add('active');
        }
        function closeImg() {
            document.getElementById('img-modal').classList.remove('active');
        }

        // Carrusel de promos (editable desde el Sheet: filas con nombre PROMO, PROMO2, PROMO3...)
        //  imagen -> diapositiva | descripcion -> título | uso -> bajada
        function renderPromo() {
            renderPanelPromo();
            // La franja del 10% queda siempre con su mensaje genérico
            const cont = document.getElementById('promo-dia');
            if (cont) {
                cont.classList.add('generic');
                cont.innerHTML = `<div class="pd-text">🎁 Pendiente de tus combos y promociones de tus productos favoritos</div>`;
            }

            const banner = document.getElementById('promo-banner');
            const dots = document.getElementById('promo-dots');
            if (promoTimer) { clearInterval(promoTimer); promoTimer = null; }
            if (!banner) return;

            if (!promos.length) {
                banner.style.display = 'none';
                if (dots) dots.style.display = 'none';
                return;
            }

            // Precargar imágenes para evitar parpadeos al rotar
            promos.forEach(pr => { const im = new Image(); im.src = pr.img.startsWith('http') ? normalizeImg(pr.img) : pr.img; });

            banner.style.display = 'block';
            promoIdx = 0;

            if (dots) {
                dots.innerHTML = promos.map((_, i) => `<button class="promo-dot${i === 0 ? ' active' : ''}" aria-label="Promoción ${i + 1}" onclick="event.preventDefault(); event.stopPropagation(); goPromo(${i});"></button>`).join('');
                dots.style.display = promos.length > 1 ? 'flex' : 'none';
            }

            showPromoSlide(0);
            if (promos.length > 1) {
                promoTimer = setInterval(() => goPromo((promoIdx + 1) % promos.length), 5000);
            }
        }

        function showPromoSlide(i) {
            const pr = promos[i];
            if (!pr) return;
            const banner = document.getElementById('promo-banner');
            const bimg = document.getElementById('promo-banner-img');
            const overlay = document.getElementById('promo-overlay');
            const t = document.getElementById('po-title');
            const s = document.getElementById('po-sub');
            const cta = document.getElementById('po-cta');
            // Destino del botón: link propio de la promo, o WhatsApp por defecto
            let href;
            if (pr.link) {
                href = /^https?:\/\//i.test(pr.link) ? pr.link : 'https://' + pr.link;
            } else {
                const msg = `Hola, quiero acceder a la promoción${pr.titulo ? ': ' + pr.titulo : ' del día'} 🔥 (al precio promo, no acumulable con el 10% de la App).`;
                href = `https://wa.me/51935896961?text=${encodeURIComponent(msg)}`;
            }
            if (banner) banner.href = href;
            if (bimg) bimg.src = pr.img.startsWith('http') ? normalizeImg(pr.img) : pr.img;
            if (t) t.textContent = pr.titulo;
            if (s) { s.textContent = pr.bajada; s.style.display = pr.bajada ? 'block' : 'none'; }
            if (cta) cta.textContent = pr.cta || 'Pídela por la App →';
            // El sello "no acumulable con el 10%" solo aplica a promos de producto (botón/link por defecto)
            const note = document.getElementById('po-note');
            if (note) note.style.display = (!pr.cta && !pr.link) ? 'block' : 'none';
            if (overlay) overlay.style.display = (pr.titulo || pr.bajada) ? 'flex' : 'none';
            document.querySelectorAll('.promo-dot').forEach((d, di) => d.classList.toggle('active', di === i));
            promoIdx = i;
        }

        function goPromo(i) {
            if (promoTimer) { clearInterval(promoTimer); promoTimer = null; }
            const banner = document.getElementById('promo-banner');
            if (banner) {
                banner.style.opacity = '0';
                setTimeout(() => { showPromoSlide(i); banner.style.opacity = '1'; }, 850);
            } else {
                showPromoSlide(i);
            }
            if (promos.length > 1) {
                promoTimer = setInterval(() => goPromo((promoIdx + 1) % promos.length), 5000);
            }
        }

        // Botón subir al inicio
        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.addEventListener('scroll', () => {
            document.getElementById('scroll-top').classList.toggle('show', window.scrollY > 300);
        });
        function verMasProductos() {
            paginaProductos += loteProductos();
            renderProducts();
        }

        // Rota las imágenes de productos que tienen 2-3 fotos, mientras el cliente navega
        function rotarImagenes() {
            if (document.hidden) return;
            document.querySelectorAll('.pc-rot').forEach(img => {
                const list = (img.dataset.imgs || '').split('|').filter(Boolean);
                if (list.length < 2) return;
                let idx = parseInt(img.dataset.idx);
                if (isNaN(idx)) idx = 0;
                idx = (idx + 1) % list.length;
                img.dataset.idx = idx;
                const nueva = list[idx];
                const pre = new Image();
                pre.onload = () => { img.style.opacity = '0.3'; setTimeout(() => { img.src = nueva; img.style.opacity = '1'; }, 180); };
                pre.onerror = () => {};
                pre.src = nueva;
            });
        }
        setInterval(rotarImagenes, 3500);

        // Funciones para Consulta con Doctorita Key
        function openConsultaModal() {
            document.getElementById('consulta-modal').classList.add('active');
        }

        function closeConsultaModal() {
            document.getElementById('consulta-modal').classList.remove('active');
            const n = document.getElementById('consulta-name');
            if (n) n.value = '';
        }

        function agendarConsulta() {
            const tipoEl = document.querySelector('input[name="consulta-tipo"]:checked');
            const tipo = tipoEl ? tipoEl.value : 'General';
            track('agendar_consulta', { tipo });
            const precio = tipo === 'Estética' ? '70' : '50';
            const name = (document.getElementById('consulta-name').value || '').trim();
            const saludo = name ? `Hola Dra. Key, soy ${name}. ` : 'Hola Dra. Key, ';
            const mensaje = `${saludo}quiero agendar una *Consulta ${tipo}* (S/ ${precio}) en su consultorio. ¿Qué disponibilidad y horarios tiene? Quedo atento(a) para coordinar y pagar por Yape para confirmar la cita.`;
            const url = `https://wa.me/51935896961?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
            closeConsultaModal();
        }

        function suscribirNewsletter() {
            const name = document.getElementById('news-name').value.trim();
            const phone = document.getElementById('news-phone').value.trim();

            if (!name || !phone) {
                alert('Por favor completa tu nombre y tu WhatsApp');
                return;
            }

            const mensaje = `🔔 NUEVA SUSCRIPCIÓN - PROMEDIC\n\n👤 Nombre: ${name}\n📱 WhatsApp: ${phone}\n\nQuiero recibir tips de salud y novedades sobre medicina y tratamientos de la Dra. Key.\n\n---\nPor favor agrégame a la lista de difusión.`;

            const url = `https://wa.me/51935896961?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');

            document.getElementById('news-name').value = '';
            document.getElementById('news-phone').value = '';
            alert('✓ ¡Gracias por suscribirte! Te agregaremos a la lista de difusión de la Dra. Key.');
        }

        // PWA: registrar service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(() => {});
            });
        }

        // PWA: botón "Instalar app"
        let deferredPrompt = null;
        const installBtn = () => document.getElementById('install-btn');
        const yaInstalada = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });

        window.addEventListener('load', () => {
            const b = installBtn();
            if (b && !yaInstalada()) b.style.display = 'flex';
        });

        function instalarApp() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.finally(() => { deferredPrompt = null; });
                return;
            }
            const ua = navigator.userAgent || '';
            const isIOS = /iphone|ipad|ipod/i.test(ua);
            if (isIOS) {
                alert('Para instalar en iPhone (Safari):\n\n1) Toca el botón Compartir (el cuadrado con la flecha hacia arriba, abajo en la pantalla).\n2) Elige "Añadir a pantalla de inicio".\n3) Toca "Añadir".');
            } else {
                alert('Para instalar la app:\n\n1) Abre el menú del navegador (los 3 puntos ⋮, arriba a la derecha).\n2) Toca "Instalar aplicación" o "Agregar a pantalla principal".\n\nSi no aparece, recarga la página e intenta otra vez.');
            }
        }

        window.addEventListener('appinstalled', () => {
            const b = installBtn();
            if (b) b.style.display = 'none';
        });

        /* ============================================================
           PANEL LATERAL DE PROMOCIONES
           Usa el mismo array `promos` que el carrusel (filas PROMO del Sheet).
           Se abre solo la primera visita del dia; luego queda la lengueta.
           ============================================================ */
        const PL_CLAVE = 'promedic_panel_promo';

        function plHoy() {
            const d = new Date();
            return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        }

        function plLeer() {
            try { return localStorage.getItem(PL_CLAVE); } catch (e) { return null; }
        }

        function plGuardar() {
            try { localStorage.setItem(PL_CLAVE, plHoy()); } catch (e) { /* modo incognito */ }
        }

        function abrirPanelPromo() {
            const panel = document.getElementById('pl-panel');
            const fondo = document.getElementById('pl-backdrop');
            if (!panel) return;
            panel.classList.add('open');
            panel.setAttribute('aria-hidden', 'false');
            if (fondo) fondo.classList.add('open');
            document.body.style.overflow = 'hidden';
            const cerrar = panel.querySelector('.pl-close');
            if (cerrar) cerrar.focus();
            plGuardar();
        }

        function cerrarPanelPromo() {
            const panel = document.getElementById('pl-panel');
            const fondo = document.getElementById('pl-backdrop');
            if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
            if (fondo) fondo.classList.remove('open');
            document.body.style.overflow = '';
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cerrarPanelPromo();
        });

        function renderPanelPromo() {
            const tab = document.getElementById('pl-tab');
            const body = document.getElementById('pl-body');
            if (!tab || !body) return;

            // Sin promos en el Sheet no mostramos nada: ni lengueta ni panel.
            if (!promos.length) {
                tab.style.display = 'none';
                cerrarPanelPromo();
                return;
            }

            body.innerHTML = promos.map((pr) => {
                const img = pr.img.startsWith('http') ? normalizeImg(pr.img) : pr.img;
                let href;
                if (pr.link) {
                    href = /^https?:\/\//i.test(pr.link) ? pr.link : 'https://' + pr.link;
                } else {
                    const msg = 'Hola, quiero acceder a la promocion' + (pr.titulo ? ': ' + pr.titulo : ' del dia') +
                                ' \u{1F525} (al precio promo, no acumulable con el 10% de la App).';
                    href = 'https://wa.me/51935896961?text=' + encodeURIComponent(msg);
                }
                const esWa = href.indexOf('wa.me') !== -1;
                const texto = pr.cta || (esWa ? 'Pedir por WhatsApp' : 'Ver promocion');
                return '<article class="pl-card">' +
                       '<img src="' + img + '" alt="' + (pr.titulo || 'Promocion') + '" loading="lazy" ' +
                       'onerror="this.style.display=\'none\';" />' +
                       '<div class="pl-card-txt">' +
                       (pr.titulo ? '<h4>' + pr.titulo + '</h4>' : '') +
                       (pr.bajada ? '<p>' + pr.bajada + '</p>' : '') +
                       '<a class="pl-cta" href="' + href + '" target="_blank" rel="noopener">' + texto + '</a>' +
                       '</div></article>';
            }).join('');

            tab.style.display = 'flex';

            // Apertura automatica del panel.
            //   'siempre' -> cada vez que se entra a la app
            //   'diario'  -> solo la primera visita de cada dia
            //   'nunca'   -> no se abre solo; queda solo la lengueta
            // Cambia esta linea para pasar de uno a otro.
            const ABRIR_PANEL = 'siempre';
            if (ABRIR_PANEL === 'siempre' || (ABRIR_PANEL === 'diario' && plLeer() !== plHoy())) {
                setTimeout(abrirPanelPromo, 900);
            }
        }
