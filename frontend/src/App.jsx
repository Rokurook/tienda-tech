import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Search, User, LogOut, Package, Tag, Truck, Store,
  CreditCard, Banknote, X, Plus, Minus, CheckCircle, AlertCircle, Settings, Eye
} from 'lucide-react';

const API_URL = 'http://localhost:8000/api';

const formatCLP = (valor) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
};

export default function App() {
  // Estados principales
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [cargando, setCargando] = useState(true);

  // Usuario y Autenticación
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('tienda_user');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [modalAuth, setModalAuth] = useState(false);
  const [esRegistro, setEsRegistro] = useState(false);
  const [formAuth, setFormAuth] = useState({ rut: '', nombre: '', email: '', password: '', direccion: '', rol: 'cliente' });
  const [errorAuth, setErrorAuth] = useState('');

  // Carrito y Checkout
  const [carrito, setCarrito] = useState([]);
  const [drawerCarrito, setDrawerCarrito] = useState(false);
  const [tipoEntrega, setTipoEntrega] = useState('DESPACHO_DOMICILIO');
  const [sucursalRetiro, setSucursalRetiro] = useState('Casa Matriz Santiago Centro');
  const [direccionDespacho, setDireccionDespacho] = useState('');
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA');
  const [codigoCupon, setCodigoCupon] = useState('');
  const [descuentoCuponPct, setDescuentoCuponPct] = useState(0);
  const [mensajeCupon, setMensajeCupon] = useState('');
  const [ordenExitosa, setOrdenExitosa] = useState(null);

  // Vistas Modales (Detalle Producto e Inventario Admin)
  const [productoDetalle, setProductoDetalle] = useState(null);
  const [vistaAdmin, setVistaAdmin] = useState(false);
  const [editandoProd, setEditandoProd] = useState(null);
  const [modalNuevoProd, setModalNuevoProd] = useState(false);
  const [nuevoProd, setNuevoProd] = useState({
    sku: 'ID-50104',
    nombre: '',
    marca: '',
    categoria: 'Notebooks',
    descripcion: '',
    precio_normal: '',
    precio_efectivo: '',
    tiene_descuento: false,
    porcentaje_descuento: 0,
    stock_despacho: 10,
    stock_tienda: 5,
    imagen_url: '',
    specsTexto: 'Procesador: \nRAM: \nAlmacenamiento: '
  });


  // Cargar productos desde el Backend
  const cargarProductos = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (buscar) params.append('buscar', buscar);
      if (categoria !== 'Todas') params.append('categoria', categoria);
      const res = await fetch(`${API_URL}/products?${params.toString()}`);
      const data = await res.json();
      setProductos(data);
    } catch (err) {
      console.error('Error cargando productos:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, [categoria]);

  useEffect(() => {
    if (usuario?.direccion) setDireccionDespacho(usuario.direccion);
  }, [usuario]);

  // Manejo de Login y Registro
  const manejarAuth = async (e) => {
    e.preventDefault();
    setErrorAuth('');
    const endpoint = esRegistro ? '/auth/register' : '/auth/login';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formAuth),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error de autenticación');
      setUsuario(data);
      localStorage.setItem('tienda_user', JSON.stringify(data));
      setModalAuth(false);
    } catch (err) {
      setErrorAuth(err.message);
    }
  };

  const cerrarSesion = () => {
    setUsuario(null);
    setVistaAdmin(false);
    localStorage.removeItem('tienda_user');
  };

  // Funciones del Carrito
  const agregarAlCarrito = (producto) => {
    setOrdenExitosa(null);
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
    setDrawerCarrito(true);
  };

  const cambiarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, cantidad: item.cantidad + delta } : item))
        .filter((item) => item.cantidad > 0)
    );
  };

  // Validar Cupón
  const aplicarCupon = async () => {
    setMensajeCupon('');
    if (!codigoCupon.trim()) return;
    try {
      const res = await fetch(`${API_URL}/coupons/${codigoCupon.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setDescuentoCuponPct(data.porcentaje_rebaja);
      setMensajeCupon(`Cupón ${data.codigo} aplicado: -${data.porcentaje_rebaja}%`);
    } catch (err) {
      setDescuentoCuponPct(0);
      setMensajeCupon(err.message);
    }
  };

  // Cálculos dinámicos del Carrito
  const calcularPrecioUnitario = (prod) => {
    const base = medioPago === 'TRANSFERENCIA' ? prod.precio_efectivo : prod.precio_normal;
    if (prod.tiene_descuento && prod.porcentaje_descuento > 0) {
      return Math.round(base * (1 - prod.porcentaje_descuento / 100));
    }
    return base;
  };

  const subtotalCarrito = carrito.reduce(
    (acc, item) => acc + calcularPrecioUnitario(item) * item.cantidad,
    0
  );
  const montoDescuentoCupon = Math.round(subtotalCarrito * (descuentoCuponPct / 100));
  const costoEnvio = tipoEntrega === 'RETIRO_TIENDA' || carrito.length === 0 ? 0 : 4990;
  const totalPagar = subtotalCarrito - montoDescuentoCupon + costoEnvio;

  // Confirmar Compra (Checkout)
  const finalizarCompra = async () => {
    if (tipoEntrega === 'DESPACHO_DOMICILIO' && !direccionDespacho.trim()) {
      alert('Por favor ingresa una dirección para el despacho.');
      return;
    }
    try {
      const payload = {
        user_id: usuario ? usuario.id : null,
        items: carrito.map((i) => ({ product_id: i.id, cantidad: i.cantidad })),
        tipo_entrega: tipoEntrega,
        sucursal_retiro: tipoEntrega === 'RETIRO_TIENDA' ? sucursalRetiro : null,
        direccion_despacho: tipoEntrega === 'DESPACHO_DOMICILIO' ? direccionDespacho : null,
        medio_pago: medioPago,
        codigo_cupon: descuentoCuponPct > 0 ? codigoCupon : null,
      };
      const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al procesar compra');
      setOrdenExitosa(data);
      setCarrito([]);
      setDescuentoCuponPct(0);
      setCodigoCupon('');
      cargarProductos(); // Refresca el stock rebajado en pantalla
    } catch (err) {
      alert(err.message);
    }
  };

  // Guardar cambios de Inventario y Descuentos (Modo Admin)
  const guardarInventarioAdmin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/inventory/${editandoProd.sku}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precio_normal: Number(editandoProd.precio_normal),
          precio_efectivo: Number(editandoProd.precio_efectivo),
          tiene_descuento: editandoProd.tiene_descuento,
          porcentaje_descuento: Number(editandoProd.porcentaje_descuento),
          stock_despacho: Number(editandoProd.stock_despacho),
          stock_tienda: Number(editandoProd.stock_tienda),
        }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar el inventario');
      setEditandoProd(null);
      cargarProductos();
    } catch (err) {
      alert(err.message);
    }
  };

  const crearProductoAdmin = async (e) => {
    e.preventDefault();
    try {
      // Convertir líneas "Clave: Valor" a objeto JSON
      const especificacionesObj = {};
      nuevoProd.specsTexto.split('\n').forEach((linea) => {
        const idx = linea.indexOf(':');
        if (idx > 0) {
          const clave = linea.slice(0, idx).trim();
          const valor = linea.slice(idx + 1).trim();
          if (clave && valor) especificacionesObj[clave] = valor;
        }
      });

      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: nuevoProd.sku,
          nombre: nuevoProd.nombre,
          marca: nuevoProd.marca,
          categoria: nuevoProd.categoria,
          descripcion: nuevoProd.descripcion,
          especificaciones: especificacionesObj,
          precio_normal: Number(nuevoProd.precio_normal),
          precio_efectivo: Number(nuevoProd.precio_efectivo),
          tiene_descuento: nuevoProd.tiene_descuento,
          porcentaje_descuento: Number(nuevoProd.porcentaje_descuento),
          stock_despacho: Number(nuevoProd.stock_despacho),
          stock_tienda: Number(nuevoProd.stock_tienda),
          imagen_url: nuevoProd.imagen_url.trim() || undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al crear producto');

      setModalNuevoProd(false);
      setNuevoProd({
        sku: `ID-${Math.floor(50105 + Math.random() * 890)}`,
        nombre: '',
        marca: '',
        categoria: 'Notebooks',
        descripcion: '',
        precio_normal: '',
        precio_efectivo: '',
        tiene_descuento: false,
        porcentaje_descuento: 0,
        stock_despacho: 10,
        stock_tienda: 5,
        imagen_url: '',
        specsTexto: 'Procesador: \nRAM: \nAlmacenamiento: '
      });
      cargarProductos();
    } catch (err) {
      alert(err.message);
    }
  };

  const categorias = ['Todas', 'Notebooks', 'Almacenamiento', 'Monitores'];

  return (
    <div className="min-h-screen flex flex-col">
      {/* NAVBAR ESTILO PC FACTORY (ADAPTABLE MÓVIL Y ESCRITORIO) */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo */}
          <div
            onClick={() => { setVistaAdmin(false); setCategoria('Todas'); }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="bg-emerald-500 text-slate-950 font-black px-2.5 py-1 rounded text-lg tracking-tight">
              TECH
            </div>
            <span className="font-bold text-xl tracking-tight">STORE</span>
          </div>

          {/* Buscador por ID/SKU o Nombre */}
          <form
            onSubmit={(e) => { e.preventDefault(); cargarProductos(); }}
            className="flex-1 min-w-[220px] max-w-xl order-3 md:order-2 flex"
          >
            <input
              type="text"
              placeholder="Buscar por producto, marca o ID (ej: ID-50101)..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="w-full px-3.5 py-2 rounded-l-lg text-slate-900 text-sm focus:outline-none"
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 rounded-r-lg flex items-center"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Acciones Usuario, Admin y Carrito */}
          <div className="flex items-center gap-2 sm:gap-3 order-2 md:order-3">
            {usuario?.rol === 'admin' && (
              <button
                onClick={() => setVistaAdmin(!vistaAdmin)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition ${
                  vistaAdmin ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Inventario</span>
              </button>
            )}

            {usuario ? (
              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg text-xs sm:text-sm">
                <User className="w-4 h-4 text-emerald-400" />
                <span className="max-w-[90px] truncate font-medium">{usuario.nombre}</span>
                <button onClick={cerrarSesion} title="Cerrar sesión" className="text-slate-400 hover:text-rose-400 ml-1">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setModalAuth(true)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium"
              >
                <User className="w-4 h-4 text-emerald-400" />
                <span>Ingresar</span>
              </button>
            )}

            <button
              onClick={() => setDrawerCarrito(true)}
              className="relative bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Carro</span>
              <span className="bg-slate-950 text-white text-xs px-1.5 py-0.5 rounded-full">
                {carrito.reduce((sum, item) => sum + item.cantidad, 0)}
              </span>
            </button>
          </div>
        </div>

        {/* Barra de Categorías */}
        <nav className="bg-slate-800 border-t border-slate-700">
          <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto py-2 text-xs sm:text-sm">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => { setVistaAdmin(false); setCategoria(cat); }}
                className={`px-3 py-1 rounded-md whitespace-nowrap font-medium transition ${
                  categoria === cat && !vistaAdmin
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {vistaAdmin ? (
          /* PANEL DE GESTIÓN DE INVENTARIO Y DESCUENTOS */
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Control de Inventario, Precios y Descuentos
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalNuevoProd(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Nuevo Producto
                </button>
                <button
                  onClick={() => setVistaAdmin(false)}
                  className="text-sm text-slate-500 hover:text-slate-800 underline"
                >
                  Volver a la tienda
                </button>
              </div>
            </div>



            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b text-slate-600">
                    <th className="p-3">ID / SKU</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Precio Efectivo</th>
                    <th className="p-3">Descuento</th>
                    <th className="p-3">Stock Despacho</th>
                    <th className="p-3">Stock Tienda</th>
                    <th className="p-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">{p.sku}</td>
                      <td className="p-3 max-w-xs truncate">{p.nombre}</td>
                      <td className="p-3 font-semibold">{formatCLP(p.precio_efectivo)}</td>
                      <td className="p-3">
                        {p.tiene_descuento ? (
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold text-xs">
                            -{p.porcentaje_descuento}% ACTIVO
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Sin descuento</span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-blue-600">{p.stock_despacho} un.</td>
                      <td className="p-3 font-bold text-emerald-600">{p.stock_tienda} un.</td>
                      <td className="p-3">
                        <button
                          onClick={() => setEditandoProd({ ...p })}
                          className="bg-slate-900 text-white px-3 py-1 rounded text-xs hover:bg-slate-700"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* GRILLA DE CATÁLOGO DE PRODUCTOS */
          <>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">
                Catálogo {categoria !== 'Todas' ? `- ${categoria}` : 'Destacado'}
              </h1>
              <span className="text-xs sm:text-sm text-slate-500">
                {productos.length} producto(s) encontrado(s)
              </span>
            </div>

            {cargando ? (
              <p className="text-center py-12 text-slate-500">Cargando catálogo...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {productos.map((prod) => {
                  const precioEfFinal = prod.tiene_descuento
                    ? Math.round(prod.precio_efectivo * (1 - prod.porcentaje_descuento / 100))
                    : prod.precio_efectivo;
                  const sinStockTotal = prod.stock_despacho === 0 && prod.stock_tienda === 0;

                  return (
                    <div
                      key={prod.id}
                      className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between overflow-hidden hover:shadow-md transition"
                    >
                      <div>
                        {/* Cabecera con ID y Badge Descuento */}
                        <div className="px-3 pt-3 flex justify-between items-center">
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            {prod.sku}
                          </span>
                          {prod.tiene_descuento && prod.porcentaje_descuento > 0 && (
                            <span className="bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <Tag className="w-3 h-3" /> -{prod.porcentaje_descuento}%
                            </span>
                          )}
                        </div>

                        {/* Imagen */}
                        <div
                          onClick={() => setProductoDetalle(prod)}
                          className="h-44 p-4 flex items-center justify-center cursor-pointer relative group"
                        >
                          <img
                            src={prod.imagen_url}
                            alt={prod.nombre}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition"
                          />
                          <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Ver detalle
                          </span>
                        </div>

                        {/* Marca y Nombre */}
                        <div className="px-4">
                          <p className="text-xs font-bold text-emerald-600 uppercase">{prod.marca}</p>
                          <h2
                            onClick={() => setProductoDetalle(prod)}
                            className="text-sm font-semibold text-slate-800 line-clamp-2 mt-0.5 cursor-pointer hover:text-emerald-600"
                          >
                            {prod.nombre}
                          </h2>
                        </div>
                      </div>

                      {/* Precios y Stock */}
                      <div className="p-4 mt-3 border-t border-slate-100 bg-slate-50/50">
                        <div className="mb-2">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-slate-500">Transferencia / Efectivo</span>
                            <span className="text-lg font-black text-emerald-600">
                              {formatCLP(precioEfFinal)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between text-xs text-slate-500 mt-0.5">
                            <span>Otros medios de pago</span>
                            <span className="font-semibold text-slate-700">
                              {formatCLP(prod.precio_normal)}
                            </span>
                          </div>
                        </div>

                        {/* Indicadores de Inventario */}
                        <div className="flex justify-between text-[11px] text-slate-600 mb-3 bg-white p-2 rounded border border-slate-200">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            Despacho: <b>{prod.stock_despacho}</b>
                          </span>
                          <span className="flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-emerald-600" />
                            Tienda: <b>{prod.stock_tienda}</b>
                          </span>
                        </div>

                        <button
                          disabled={sinStockTotal}
                          onClick={() => agregarAlCarrito(prod)}
                          className={`w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${
                            sinStockTotal
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-900 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          {sinStockTotal ? 'Agotado' : 'Agregar al Carro'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL DETALLE DEL PRODUCTO */}
      {productoDetalle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setProductoDetalle(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-center bg-slate-50 rounded-xl p-4">
                <img
                  src={productoDetalle.imagen_url}
                  alt={productoDetalle.nombre}
                  className="max-h-60 object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-mono bg-slate-200 px-2 py-0.5 rounded font-bold">
                  Código: {productoDetalle.sku}
                </span>
                <p className="text-xs font-bold text-emerald-600 uppercase mt-2">
                  {productoDetalle.marca} • {productoDetalle.categoria}
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{productoDetalle.nombre}</h3>
                <p className="text-xs text-slate-600 mt-2">{productoDetalle.descripcion}</p>

                <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs text-emerald-800">Precio Transferencia</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {formatCLP(
                      productoDetalle.tiene_descuento
                        ? Math.round(
                            productoDetalle.precio_efectivo *
                              (1 - productoDetalle.porcentaje_descuento / 100)
                          )
                        : productoDetalle.precio_efectivo
                    )}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Precio Normal Tarjetas: <b>{formatCLP(productoDetalle.precio_normal)}</b>
                  </p>
                </div>

                <button
                  onClick={() => {
                    agregarAlCarrito(productoDetalle);
                    setProductoDetalle(null);
                  }}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg"
                >
                  Agregar al Carro
                </button>
              </div>
            </div>

            {/* Tabla de Especificaciones Técnicas */}
            {productoDetalle.especificaciones && (
              <div className="mt-6 border-t pt-4">
                <h4 className="font-bold text-sm mb-2">Especificaciones Técnicas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(productoDetalle.especificaciones).map(([clave, valor]) => (
                    <div key={clave} className="bg-slate-50 p-2 rounded flex justify-between border">
                      <span className="text-slate-500 font-medium">{clave}:</span>
                      <span className="font-bold text-slate-800">{valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL LOGIN Y REGISTRO DE USUARIO */}
      {modalAuth && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setModalAuth(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold mb-1">
              {esRegistro ? 'Crear Cuenta' : 'Ingreso de Usuario'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {esRegistro
                ? 'Regístrate como Cliente o Administrador para gestionar inventario'
                : 'Ingresa tus credenciales para comprar o administrar'}
            </p>

            {errorAuth && (
              <div className="bg-rose-50 text-rose-700 p-2.5 rounded-lg text-xs mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorAuth}</span>
              </div>
            )}

            <form onSubmit={manejarAuth} className="space-y-3 text-sm">
              {esRegistro && (
                <>
                  <input
                    required
                    type="text"
                    placeholder="RUT (ej: 18.456.789-0)"
                    value={formAuth.rut}
                    onChange={(e) => setFormAuth({ ...formAuth, rut: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <input
                    required
                    type="text"
                    placeholder="Nombre completo"
                    value={formAuth.nombre}
                    onChange={(e) => setFormAuth({ ...formAuth, nombre: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Dirección de despacho"
                    value={formAuth.direccion}
                    onChange={(e) => setFormAuth({ ...formAuth, direccion: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Tipo de Perfil:</label>
                    <select
                      value={formAuth.rol}
                      onChange={(e) => setFormAuth({ ...formAuth, rol: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="cliente">Cliente (Compras y Despacho)</option>
                      <option value="admin">Administrador (Control Stock y Descuentos)</option>
                    </select>
                  </div>
                </>
              )}

              <input
                required
                type="email"
                placeholder="Correo electrónico"
                value={formAuth.email}
                onChange={(e) => setFormAuth({ ...formAuth, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                required
                type="password"
                placeholder="Contraseña"
                value={formAuth.password}
                onChange={(e) => setFormAuth({ ...formAuth, password: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg"
              >
                {esRegistro ? 'Registrarme' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="mt-4 text-center text-xs text-slate-600">
              {esRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
              <button
                onClick={() => { setEsRegistro(!esRegistro); setErrorAuth(''); }}
                className="text-emerald-600 font-bold underline"
              >
                {esRegistro ? 'Inicia sesión aquí' : 'Regístrate gratis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN DE INVENTARIO Y DESCUENTO (ADMIN) */}
      {editandoProd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={guardarInventarioAdmin}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3 text-sm"
          >
            <h3 className="font-bold text-lg">Editar {editandoProd.sku}</h3>
            <p className="text-xs text-slate-500">{editandoProd.nombre}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Precio Normal ($)</label>
                <input
                  type="number"
                  value={editandoProd.precio_normal}
                  onChange={(e) => setEditandoProd({ ...editandoProd, precio_normal: e.target.value })}
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Precio Efectivo ($)</label>
                <input
                  type="number"
                  value={editandoProd.precio_efectivo}
                  onChange={(e) => setEditandoProd({ ...editandoProd, precio_efectivo: e.target.value })}
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Stock Despacho</label>
                <input
                  type="number"
                  value={editandoProd.stock_despacho}
                  onChange={(e) => setEditandoProd({ ...editandoProd, stock_despacho: e.target.value })}
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Stock Tienda</label>
                <input
                  type="number"
                  value={editandoProd.stock_tienda}
                  onChange={(e) => setEditandoProd({ ...editandoProd, stock_tienda: e.target.value })}
                  className="w-full border rounded p-2"
                />
              </div>
            </div>

            <div className="border-t pt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editandoProd.tiene_descuento}
                  onChange={(e) => setEditandoProd({ ...editandoProd, tiene_descuento: e.target.checked })}
                />
                Activar Descuento (%)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                disabled={!editandoProd.tiene_descuento}
                value={editandoProd.porcentaje_descuento}
                onChange={(e) => setEditandoProd({ ...editandoProd, porcentaje_descuento: e.target.value })}
                className="w-20 border rounded p-1.5 text-center"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setEditandoProd(null)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* MODAL CREAR NUEVO PRODUCTO (ADMIN) */}
      {modalNuevoProd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={crearProductoAdmin}
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-3 text-sm relative"
          >
            <button
              type="button"
              onClick={() => setModalNuevoProd(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-lg text-slate-900">Agregar Nuevo Producto al Catálogo</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold">Código ID / SKU *</label>
                <input
                  required
                  type="text"
                  placeholder="ID-50104"
                  value={nuevoProd.sku}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, sku: e.target.value.toUpperCase() })}
                  className="w-full border rounded-lg p-2 font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Marca *</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Lenovo, Logitech"
                  value={nuevoProd.marca}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, marca: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Categoría *</label>
                <select
                  value={nuevoProd.categoria}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, categoria: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-white"
                >
                  <option value="Notebooks">Notebooks</option>
                  <option value="Almacenamiento">Almacenamiento</option>
                  <option value="Monitores">Monitores</option>
                  <option value="Periféricos">Periféricos</option>
                  <option value="Componentes">Componentes</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold">Nombre del Producto *</label>
              <input
                required
                type="text"
                placeholder="Ej: Teclado Mecánico RGB Redragon Kumara K552"
                value={nuevoProd.nombre}
                onChange={(e) => setNuevoProd({ ...nuevoProd, nombre: e.target.value })}
                className="w-full border rounded-lg p-2"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Descripción General *</label>
              <textarea
                required
                rows="2"
                placeholder="Breve resumen comercial del equipo..."
                value={nuevoProd.descripcion}
                onChange={(e) => setNuevoProd({ ...nuevoProd, descripcion: e.target.value })}
                className="w-full border rounded-lg p-2"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold">Precio Normal ($) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={nuevoProd.precio_normal}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, precio_normal: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Precio Efectivo ($) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={nuevoProd.precio_efectivo}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, precio_efectivo: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Stock Despacho *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={nuevoProd.stock_despacho}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, stock_despacho: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Stock Tienda *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={nuevoProd.stock_tienda}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, stock_tienda: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border flex items-center justify-between">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={nuevoProd.tiene_descuento}
                  onChange={(e) => setNuevoProd({ ...nuevoProd, tiene_descuento: e.target.checked })}
                />
                Aplicar Etiqueta de Descuento (%)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                disabled={!nuevoProd.tiene_descuento}
                value={nuevoProd.porcentaje_descuento}
                onChange={(e) => setNuevoProd({ ...nuevoProd, porcentaje_descuento: e.target.value })}
                className="w-20 border rounded p-1.5 text-center bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">URL de Imagen (Opcional)</label>
              <input
                type="url"
                placeholder="https://... (si se deja vacío usa imagen genérica)"
                value={nuevoProd.imagen_url}
                onChange={(e) => setNuevoProd({ ...nuevoProd, imagen_url: e.target.value })}
                className="w-full border rounded-lg p-2"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Especificaciones Técnicas (Formato Clave: Valor)</label>
              <textarea
                rows="3"
                value={nuevoProd.specsTexto}
                onChange={(e) => setNuevoProd({ ...nuevoProd, specsTexto: e.target.value })}
                className="w-full border rounded-lg p-2 font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalNuevoProd(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
              >
                Guardar Producto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DRAWER LATERAL: CARRITO DE COMPRAS Y CHECKOUT */}
      {drawerCarrito && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center bg-slate-900 text-white">
              <h2 className="font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                Carro de Compras
              </h2>
              <button onClick={() => setDrawerCarrito(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {ordenExitosa ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h3 className="font-bold text-lg text-emerald-900">¡Compra Confirmada!</h3>
                  <p className="text-xs text-emerald-700">Orden N° #{ordenExitosa.orden_id}</p>
                  <div className="text-left text-xs bg-white p-3 rounded border space-y-1 mt-3">
                    <p><b>Entrega:</b> {ordenExitosa.tipo_entrega === 'RETIRO_TIENDA' ? 'Retiro en Tienda' : 'Despacho a Domicilio'}</p>
                    <p><b>Medio de Pago:</b> {ordenExitosa.medio_pago}</p>
                    <p><b>Total Pagado:</b> {formatCLP(ordenExitosa.total_pagado)}</p>
                  </div>
                  <button
                    onClick={() => { setOrdenExitosa(null); setDrawerCarrito(false); }}
                    className="mt-4 w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-bold"
                  >
                    Seguir Comprando
                  </button>
                </div>
              ) : carrito.length === 0 ? (
                <p className="text-center text-slate-400 py-12 text-sm">Tu carro está vacío.</p>
              ) : (
                <>
                  {/* Lista de Productos */}
                  <div className="space-y-3">
                    {carrito.map((item) => (
                      <div key={item.id} className="flex gap-3 border-b pb-3 items-center">
                        <img src={item.imagen_url} alt={item.nombre} className="w-14 h-14 object-contain" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-mono text-slate-400">{item.sku}</p>
                          <p className="text-xs font-semibold truncate">{item.nombre}</p>
                          <p className="text-sm font-bold text-emerald-600">
                            {formatCLP(calcularPrecioUnitario(item))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => cambiarCantidad(item.id, -1)}
                            className="p-1 bg-slate-100 rounded hover:bg-slate-200"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">{item.cantidad}</span>
                          <button
                            onClick={() => cambiarCantidad(item.id, 1)}
                            className="p-1 bg-slate-100 rounded hover:bg-slate-200"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Modalidad: Despacho o Retiro */}
                  <div className="bg-slate-50 p-3 rounded-xl border space-y-2 text-xs">
                    <p className="font-bold text-slate-700">1. Modalidad de Entrega</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoEntrega('DESPACHO_DOMICILIO')}
                        className={`p-2 rounded-lg border flex items-center justify-center gap-1 font-semibold ${
                          tipoEntrega === 'DESPACHO_DOMICILIO'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700'
                        }`}
                      >
                        <Truck className="w-4 h-4" /> Despacho
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoEntrega('RETIRO_TIENDA')}
                        className={`p-2 rounded-lg border flex items-center justify-center gap-1 font-semibold ${
                          tipoEntrega === 'RETIRO_TIENDA'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700'
                        }`}
                      >
                        <Store className="w-4 h-4" /> Retiro Tienda
                      </button>
                    </div>

                    {tipoEntrega === 'DESPACHO_DOMICILIO' ? (
                      <input
                        type="text"
                        placeholder="Ingresa dirección de despacho..."
                        value={direccionDespacho}
                        onChange={(e) => setDireccionDespacho(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white mt-2"
                      />
                    ) : (
                      <select
                        value={sucursalRetiro}
                        onChange={(e) => setSucursalRetiro(e.target.value)}
                        className="w-full border rounded-lg p-2 bg-white mt-2"
                      >
                        <option>Casa Matriz Santiago Centro</option>
                        <option>Sucursal Providencia</option>
                        <option>Sucursal Plaza Vespucio</option>
                      </select>
                    )}
                  </div>

                  {/* Medio de Pago */}
                  <div className="bg-slate-50 p-3 rounded-xl border space-y-2 text-xs">
                    <p className="font-bold text-slate-700">2. Medio de Pago</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMedioPago('TRANSFERENCIA')}
                        className={`p-2 rounded-lg border flex items-center justify-center gap-1 font-semibold ${
                          medioPago === 'TRANSFERENCIA'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700'
                        }`}
                      >
                        <Banknote className="w-4 h-4" /> Transferencia
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedioPago('WEBPAY_CREDITO')}
                        className={`p-2 rounded-lg border flex items-center justify-center gap-1 font-semibold ${
                          medioPago === 'WEBPAY_CREDITO'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" /> Webpay / Tarjeta
                      </button>
                    </div>
                  </div>

                  {/* Cupón de Descuento */}
                  <div className="bg-slate-50 p-3 rounded-xl border space-y-1.5 text-xs">
                    <p className="font-bold text-slate-700">3. Cupón de Descuento (Opcional)</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej: CYBERTECH10"
                        value={codigoCupon}
                        onChange={(e) => setCodigoCupon(e.target.value)}
                        className="flex-1 border rounded-lg px-2.5 py-1.5 bg-white uppercase"
                      />
                      <button
                        type="button"
                        onClick={aplicarCupon}
                        className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-semibold"
                      >
                        Aplicar
                      </button>
                    </div>
                    {mensajeCupon && <p className="text-emerald-600 font-semibold">{mensajeCupon}</p>}
                  </div>
                </>
              )}
            </div>

            {/* Resumen Final de Pago */}
            {carrito.length > 0 && !ordenExitosa && (
              <div className="p-4 border-t bg-slate-50 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCLP(subtotalCarrito)}</span>
                </div>
                {montoDescuentoCupon > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Descuento Cupón:</span>
                    <span>-{formatCLP(montoDescuentoCupon)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Costo Envío:</span>
                  <span className="font-semibold">
                    {costoEnvio === 0 ? 'GRATIS' : formatCLP(costoEnvio)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t">
                  <span>Total a Pagar:</span>
                  <span>{formatCLP(totalPagar)}</span>
                </div>
                <button
                  onClick={finalizarCompra}
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm"
                >
                  Confirmar y Pagar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}