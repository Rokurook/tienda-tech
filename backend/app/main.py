from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from passlib.context import CryptContext
from .database import Base, get_db

app = FastAPI(title="API Tienda Tech - Estilo PC Factory")

# Permitir conexión desde el Frontend (Escritorio y Móvil)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ==================== MODELOS SQL ====================

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    rut = Column(String(15), unique=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    direccion = Column(Text)
    rol = Column(String(20), default="cliente")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(20), unique=True, nullable=False)
    nombre = Column(String(150), nullable=False)
    marca = Column(String(50), nullable=False)
    categoria = Column(String(50), nullable=False)
    descripcion = Column(Text, nullable=False)
    especificaciones = Column(JSON)
    precio_normal = Column(Integer, nullable=False)
    precio_efectivo = Column(Integer, nullable=False)
    tiene_descuento = Column(Boolean, default=False)
    porcentaje_descuento = Column(Integer, default=0)
    stock_despacho = Column(Integer, default=0)
    stock_tienda = Column(Integer, default=0)
    imagen_url = Column(Text)
    activo = Column(Boolean, default=True)

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(30), unique=True, nullable=False)
    porcentaje_rebaja = Column(Integer, nullable=False)
    activo = Column(Boolean, default=True)

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    subtotal = Column(Integer, nullable=False)
    descuento_monto = Column(Integer, default=0)
    costo_envio = Column(Integer, default=0)
    total_final = Column(Integer, nullable=False)
    tipo_entrega = Column(String(30), nullable=False)
    sucursal_retiro = Column(String(80), nullable=True)
    direccion_despacho = Column(Text, nullable=True)
    medio_pago = Column(String(30), nullable=False)
    estado = Column(String(30), default="PAGADO")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    sku = Column(String(20), nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Integer, nullable=False)

# ==================== ESQUEMAS PYDANTIC ====================

class UserRegister(BaseModel):
    rut: str
    nombre: str
    email: str
    password: str
    direccion: Optional[str] = ""
    rol: Optional[str] = "cliente"

class UserLogin(BaseModel):
    email: str
    password: str

class ProductUpdateStockDiscount(BaseModel):
    precio_normal: int
    precio_efectivo: int
    tiene_descuento: bool
    porcentaje_descuento: int
    stock_despacho: int
    stock_tienda: int

class ProductCreate(BaseModel):
    sku: str
    nombre: str
    marca: str
    categoria: str
    descripcion: str
    especificaciones: Optional[Dict[str, str]] = {}
    precio_normal: int
    precio_efectivo: int
    tiene_descuento: bool = False
    porcentaje_descuento: int = 0
    stock_despacho: int = 0
    stock_tienda: int = 0
    imagen_url: Optional[str] = "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600"


class CartItemSchema(BaseModel):
    product_id: int
    cantidad: int

class CheckoutRequest(BaseModel):
    user_id: Optional[int] = None
    items: List[CartItemSchema]
    tipo_entrega: str          # 'RETIRO_TIENDA' o 'DESPACHO_DOMICILIO'
    sucursal_retiro: Optional[str] = None
    direccion_despacho: Optional[str] = None
    medio_pago: str            # 'TRANSFERENCIA', 'WEBPAY_DEBITO', 'WEBPAY_CREDITO'
    codigo_cupon: Optional[str] = None

# ==================== RUTAS DE LA API ====================

@app.get("/")
def health_check():
    return {"status": "ok", "servicio": "API Tienda Tech Operativa"}

# 1. LOGIN Y REGISTRO DE USUARIOS
@app.post("/api/auth/register")
def registrar_usuario(datos: UserRegister, db: Session = Depends(get_db)):
    existe = db.query(User).filter((User.email == datos.email) | (User.rut == datos.rut)).first()
    if existe:
        raise HTTPException(status_code=400, detail="El RUT o Email ya está registrado")
    nuevo = User(
        rut=datos.rut,
        nombre=datos.nombre,
        email=datos.email,
        password_hash=pwd_context.hash(datos.password),
        direccion=datos.direccion,
        rol=datos.rol
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return {"id": nuevo.id, "nombre": nuevo.nombre, "email": nuevo.email, "rol": nuevo.rol}

@app.post("/api/auth/login")
def login_usuario(credenciales: UserLogin, db: Session = Depends(get_db)):
    usuario = db.query(User).filter(User.email == credenciales.email).first()
    if not usuario or not pwd_context.verify(credenciales.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return {
        "id": usuario.id,
        "rut": usuario.rut,
        "nombre": usuario.nombre,
        "email": usuario.email,
        "direccion": usuario.direccion,
        "rol": usuario.rol
    }

# 2. CATÁLOGO Y BÚSQUEDA POR ID (SKU) O NOMBRE
@app.get("/api/products")
def listar_productos(buscar: Optional[str] = None, categoria: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Product).filter(Product.activo == True)
    if categoria and categoria != "Todas":
        query = query.filter(Product.categoria == categoria)
    if buscar:
        patron = f"%{buscar}%"
        query = query.filter((Product.nombre.ilike(patron)) | (Product.sku.ilike(patron)) | (Product.marca.ilike(patron)))
    return query.order_by(Product.id.asc()).all()

@app.get("/api/products/{sku}")
def obtener_detalle_producto(sku: str, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.sku == sku.upper()).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return prod

# 3. GESTIÓN DE INVENTARIO Y DESCUENTOS (MODO ADMIN)
@app.post("/api/products")
def crear_producto(datos: ProductCreate, db: Session = Depends(get_db)):
    sku_limpio = datos.sku.strip().upper()
    existe = db.query(Product).filter(Product.sku == sku_limpio).first()
    if existe:
        raise HTTPException(status_code=400, detail=f"Ya existe un producto registrado con el código {sku_limpio}")

    nuevo_prod = Product(
        sku=sku_limpio,
        nombre=datos.nombre,
        marca=datos.marca,
        categoria=datos.categoria,
        descripcion=datos.descripcion,
        especificaciones=datos.especificaciones,
        precio_normal=datos.precio_normal,
        precio_efectivo=datos.precio_efectivo,
        tiene_descuento=datos.tiene_descuento,
        porcentaje_descuento=datos.porcentaje_descuento if datos.tiene_descuento else 0,
        stock_despacho=datos.stock_despacho,
        stock_tienda=datos.stock_tienda,
        imagen_url=datos.imagen_url or "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600",
        activo=True
    )
    db.add(nuevo_prod)
    db.commit()
    db.refresh(nuevo_prod)
    return {"mensaje": "Producto creado con éxito", "producto": nuevo_prod}

@app.put("/api/inventory/{sku}")
def actualizar_inventario_y_descuento(sku: str, datos: ProductUpdateStockDiscount, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.sku == sku.upper()).first()
    if not prod:
        raise HTTPException(status_code=404, detail="SKU no encontrado")
    prod.precio_normal = datos.precio_normal
    prod.precio_efectivo = datos.precio_efectivo
    prod.tiene_descuento = datos.tiene_descuento
    prod.porcentaje_descuento = datos.porcentaje_descuento
    prod.stock_despacho = datos.stock_despacho
    prod.stock_tienda = datos.stock_tienda
    db.commit()
    db.refresh(prod)
    return {"mensaje": "Inventario y descuentos actualizados", "producto": prod}

@app.delete("/api/products/{sku}")
def eliminar_producto(sku: str, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.sku == sku.upper()).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    prod.activo = False
    db.commit()
    return {"mensaje": f"Producto {prod.sku} eliminado del catálogo"}


# 4. VALIDACIÓN DE CUPONES
@app.get("/api/coupons/{codigo}")
def validar_cupon(codigo: str, db: Session = Depends(get_db)):
    cupon = db.query(Coupon).filter(Coupon.codigo == codigo.upper(), Coupon.activo == True).first()
    if not cupon:
        raise HTTPException(status_code=404, detail="Cupón inválido o expirado")
    return {"codigo": cupon.codigo, "porcentaje_rebaja": cupon.porcentaje_rebaja}

# 5. CHECKOUT: CARRITO, MEDIO DE PAGO, DESPACHO/RETIRO Y REBAJA DE STOCK
@app.post("/api/checkout")
def procesar_compra(orden: CheckoutRequest, db: Session = Depends(get_db)):
    if not orden.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío")

    subtotal = 0
    items_procesados = []

    for item in orden.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto ID {item.product_id} no existe")

        # Validar y descontar stock según modalidad (Retiro vs Despacho)
        if orden.tipo_entrega == "RETIRO_TIENDA":
            if prod.stock_tienda < item.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente en tienda para {prod.sku} ({prod.nombre})")
            prod.stock_tienda -= item.cantidad
        else:
            if prod.stock_despacho < item.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para despacho en {prod.sku} ({prod.nombre})")
            prod.stock_despacho -= item.cantidad

        # Determinar precio según medio de pago (Transferencia usa precio_efectivo, Tarjetas usa precio_normal)
        precio_base = prod.precio_efectivo if orden.medio_pago == "TRANSFERENCIA" else prod.precio_normal

        # Aplicar descuento propio del producto si tiene_descuento está activo
        if prod.tiene_descuento and prod.porcentaje_descuento > 0:
            precio_final_unitario = int(precio_base * (1 - prod.porcentaje_descuento / 100))
        else:
            precio_final_unitario = precio_base

        subtotal += precio_final_unitario * item.cantidad
        items_procesados.append({
            "product_id": prod.id,
            "sku": prod.sku,
            "cantidad": item.cantidad,
            "precio_unitario": precio_final_unitario
        })

    # Aplicar cupón adicional si fue ingresado
    descuento_monto = 0
    if orden.codigo_cupon:
        cupon = db.query(Coupon).filter(Coupon.codigo == orden.codigo_cupon.upper(), Coupon.activo == True).first()
        if cupon:
            descuento_monto = int(subtotal * (cupon.porcentaje_rebaja / 100))

    # Calcular costo de envío ($0 para retiro en tienda, $4.990 para despacho a domicilio)
    costo_envio = 0 if orden.tipo_entrega == "RETIRO_TIENDA" else 4990
    total_final = subtotal - descuento_monto + costo_envio

    nueva_orden = Order(
        user_id=orden.user_id,
        subtotal=subtotal,
        descuento_monto=descuento_monto,
        costo_envio=costo_envio,
        total_final=total_final,
        tipo_entrega=orden.tipo_entrega,
        sucursal_retiro=orden.sucursal_retiro,
        direccion_despacho=orden.direccion_despacho,
        medio_pago=orden.medio_pago,
        estado="PAGADO"
    )
    db.add(nueva_orden)
    db.flush()

    for det in items_procesados:
        db.add(OrderItem(
            order_id=nueva_orden.id,
            product_id=det["product_id"],
            sku=det["sku"],
            cantidad=det["cantidad"],
            precio_unitario=det["precio_unitario"]
        ))

    db.commit()
    db.refresh(nueva_orden)
    return {
        "mensaje": "Compra realizada con éxito",
        "orden_id": nueva_orden.id,
        "subtotal": subtotal,
        "descuento_cupon": descuento_monto,
        "costo_envio": costo_envio,
        "total_pagado": total_final,
        "tipo_entrega": orden.tipo_entrega,
        "medio_pago": orden.medio_pago
    }