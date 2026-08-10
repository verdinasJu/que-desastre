# Guía de usuario — Que Desastre

App: [https://que-desastre.vercel.app](https://que-desastre.vercel.app)

## Primer uso

1. **Crear cuenta** (email + contraseña)
2. **Onboarding**
   - Ingreso mensual y día de cobro
   - Ahorro / liquidez (dinero en cuenta, no inversiones)
   - Gastos fijos (alquiler, gym…)
3. Entras al **Inicio**

Las inversiones detalladas se añaden después en **Más → Inversiones**.

---

## Inicio (dashboard)

- **Patrimonio total** — ahorro + cartera + ingresos − gastos − fijos pendientes
- **Disponible** — lo que te queda para gastar este mes
- **Gastado** — fijos + variables
- **Campana** — avisos (sobrepresupuesto, gastos raros)
- **Gráficas** — evolución y gastos por categoría (toca una categoría para ver el detalle)
- **Metas** — objetivos de ahorro

---

## Movimientos

- Botón **+** o pantalla Movimientos: gasto / ingreso / inversión
- Filtra por fechas y texto
- Editar o borrar
- Importar CSV si lo necesitas

**Inversión (movimiento)** = “saqué dinero de la cuenta y lo metí en bolsa”. No baja el patrimonio total; baja el disponible del mes.

---

## Más → Inversiones (cartera)

Aquí va BTC, XRP, fondos, acciones… con **precio en vivo**.

### Añadir una posición

1. **Añadir** (o un chip: Bitcoin, XRP, Fidelity MSCI World…)
2. **Cantidad** — lo que tienes en el bróker  
3. **Lo metido (€)** — en Trade Republic: `Activos × Precio medio de compra`  
4. **Símbolo** — obligatorio (los chips lo rellenan solos)
5. Guardar — la app obtiene el precio y calcula el valor

### Qué es el símbolo

| Tipo | Dónde mirarlo | Ejemplo |
|------|---------------|---------|
| Crypto | CoinGecko (id) | `bitcoin`, `ripple` |
| Fondo Trade Republic (Fidelity MSCI hedged) | Chip **Fidelity MSCI World** | `0P0001CJGV.F` |
| ETF | Yahoo / bolsa | `VWCE.DE` |
| Acción | Ticker | `AAPL`, `TSLA` |

Sin símbolo **no** hay actualización automática.

### Cuándo se actualiza el precio

- Al abrir **Inicio** o **Inversiones** (si pasaron ~15 min)
- Al pulsar **Actualizar precios**
- Al guardar una posición nueva/editada

### Editar / borrar

Lápiz o tocar el nombre → cambia cantidad, lo metido o símbolo.  
Papelera → elimina la posición.

### Migrar desde “inversión inicial”

1. Añade **todas** tus posiciones (BTC + XRP + fondo…) el mismo día  
2. Comprueba que el “Valor ahora” se acerque a tu bróker  
3. Al existir cartera, el valor antiguo de inversión inicial se limpia solo  

---

## Gastos fijos

En **Ajustes**: lista de fijos activos.

Cada mes se registran solos como movimiento (día 1).  
Si ya pagaste casi todo a mano, no se duplica.

El **disponible** y el **gastado** usan la suma de fijos configurados (no solo los movimientos auto).

---

## Presupuestos

- Tope por categoría al mes
- Opcional: compartir con **código de un solo uso** (otra persona lo canjea)

---

## Viajes

- Presupuesto del viaje y gastos asociados
- Se puede compartir con código

---

## Deudas

Lista “te deben / debes tú”.  
**No** cambia el patrimonio hasta que registres un movimiento real.

---

## Calculadora

Simula interés compuesto. Si tienes cartera, puede partir de su valor actual.

---

## Ajustes

- Ingreso mensual y día de cobro  
- Horas/mes (para ver gastos en “horas de trabajo”)  
- Ahorro / liquidez  
- Gastos fijos y categorías  
- Cerrar sesión  

---

## Preguntas frecuentes

**¿Se conecta a Trade Republic?**  
No. Los precios son de mercado (CoinGecko / Yahoo). Tú introduces cantidad y lo metido.

**¿Por qué el patrimonio no es exactamente el del banco?**  
Comisiones, spreads, desfase de precios o liquidez no registrada. La cartera usa precio de mercado público.

**¿Puedo añadir más activos?**  
Sí: Añadir → tipo + símbolo + cantidad + lo metido.
