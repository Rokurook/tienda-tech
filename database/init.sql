--1. Tabla de Usuarios (login y roles)
CREATE TABLE users(
    id SERIAL PRIMARY KEY, 
    rut VARCHAR(15) UNIQUE NOT NULL, 
    nombre VARCHAR(100) NOT NULL, 
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, 
    direccion TEXT, 
    rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin')),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--2. Tabla de Productos e Inventario 
CREATE TABLE products(
    id SERIAL PRIMARY KEY, 
    sku VARCHAR(20) UNIQUE NOT NULL,         -- Número de identificación (Ej: ID-48102)
    nombre VARCHAR(150) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    categoria VARCHAR(50) NOT NULL, 
    descripcion TEXT NOT NULL, 
    especificaciones JSONB,                   --Detalle Técnicos flexibles
    precio_normal INTEGER NOT NULL,           -- Precio con cualquier medio de pago
    precio_efectivo INTEGER NOT NULL,         -- Precio rebajado por transferencia/efectivo
    tiene_descuento BOOLEAN DEFAULT FALSE,    -- Activa etiqueta de oferta
    porcentaje_descuento INTEGER DEFAULT 0,   -- % de descuento adicional aplicable
    stock_despacho INTEGER DEFAULT 0 CHECK (stock_despacho >= 0),
    stock_tienda INTEGER DEFAULT 0 CHECK (stock_tienda >=0), 
    imagen_url TEXT,
    activo BOOLEAN DEFAULT TRUE
);

--3. Tabla de Cupones de Descuentos
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY, 
    codigo VARCHAR(30) UNIQUE NOT NULL, 
    porcentaje_rebaja INTEGER NOT NULL CHECK (porcentaje_rebaja > 0 AND porcentaje_rebaja <= 100),
    activo BOOLEAN DEFAULT TRUE
);

--4. Tabla de Ordenes de Compra( Chekout, Envio y pago)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id), 
    subtotal INTEGER NOT NULL,
    descuento_monto INTEGER DEFAULT 0,
    costo_envio INTEGER INTEGER DEFAUL 0,
    total_final INTEGER NOT NULL,
    tipo_entrega VARCHAR(30) NOT NULL CHECK (tipo_entrega IN ('RETIRO_TIENDA', 'DESPACHO_DOMICILIO')),
    sucursal_retiro VARCHAR(80),
    direccion_despacho TEXT,
    medio_pago VARCHAR(30) NOT NULL CHECK (medio_pago IN ('TRANFERENCIA', 'WEBPAY_CREDITO')),
    estado VARCHAR(30) DEFAULT 'PAGADO',
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--5.Detalle de Productos por Orden
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, 
    sku VARCHAR(20) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario INTEGER NOT NULL
);

-- DATOS SEMILLA DE PRUEBA --

-- Cupones de prueba
INSERT INTO coupons (codigo, porcentaje_rebaja, activo) VALUES
('CYBERTECH10', 10, TRUE),
('PROMO5', 5, TRUE);

-- Productos iniciales con ID (SKU), precios en CLP y stock
INSERT INTO products (sku, nombre, marca, categoria, descripcion, especificaciones, precio_normal, precio_efectivo, tiene_descuento, porcentaje_descuento, stock_despacho, stock_tienda, imagen_url) VALUES
(
    'ID-50101',
    'Notebook Gamer Victus 15-fa1093dx Intel Core i5 16GB 512GB SSD RTX 3050',
    'HP',
    'Notebooks',
    'Equipo portátil de alto rendimiento ideal para gaming, virtualización y desarrollo pesado.',
    '{"Procesador": "Intel Core i5-13420H", "RAM": "16GB DDR4 3200MHz", "Almacenamiento": "512GB SSD NVMe", "Pantalla": "15.6 FHD 144Hz", "GPU": "NVIDIA RTX 3050 6GB"}',
    849990,
    799990,
    TRUE,
    10,
    12,
    5,
    'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600'
),
(
    'ID-50102',
    'Unidad SSD 1TB NVMe PCIe Gen4 M.2 Kingston NV2',
    'Kingston',
    'Almacenamiento',
    'Almacenamiento sólido ultrarrápido en formato M.2 2280 para actualización de notebooks y PCs de escritorio.',
    '{"Capacidad": "1TB", "Formato": "M.2 2280", "Interfaz": "PCIe 4.0 x4 NVMe", "Lectura": "3500 MB/s", "Escritura": "2100 MB/s"}',
    69990,
    64990,
    FALSE,
    0,
    25,
    18,
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600'
),
(
    'ID-50103',
    'Monitor Gamer 27" IPS Full HD 165Hz 1ms FreeSync',
    'ASUS',
    'Monitores',
    'Panel IPS con colores precisos y tasa de refresco fluida para configuraciones de doble monitor.',
    '{"Tamaño": "27 pulgadas", "Resolución": "1920x1080", "Tasa de refresco": "165Hz", "Conectividad": "2x HDMI 2.0, 1x DisplayPort 1.2"}',
    189990,
    174990,
    TRUE,
    5,
    8,
    3,
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600'
);