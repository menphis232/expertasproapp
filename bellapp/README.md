# BellApp

Aplicación móvil de gestión de citas desarrollada con Ionic, Angular y PrimeNG.

## Características

- 🔐 Login con diseño profesional y UX/UI optimizado
- 📊 Dashboard con estadísticas en tiempo real
- 📅 Calendario móvil optimizado
- 🎨 Diseño moderno y responsive
- 📱 Optimizado para dispositivos móviles

## Tecnologías

- **Ionic 7** - Framework móvil
- **Angular 17** - Framework web
- **PrimeNG 17** - Componentes UI
- **TypeScript** - Lenguaje de programación
- **SCSS** - Estilos

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Ejecutar en desarrollo:
```bash
npm start
```

3. Abrir en el navegador:
```
http://localhost:4200
```

## Estructura del Proyecto

```
src/
├── app/
│   ├── pages/
│   │   ├── login/          # Página de login
│   │   ├── dashboard/      # Dashboard principal
│   │   └── calendar/       # Calendario de citas
│   ├── services/
│   │   └── appointments.service.ts
│   ├── app.module.ts
│   └── app-routing.module.ts
└── styles.scss
```

## Colores

- **Primario**: #7c3aed (Púrpura)
- **Pendientes**: #fbbf24 (Amarillo)
- **Realizadas**: #14b8a6 (Teal)
- **Canceladas**: #ef4444 (Rojo)

## Desarrollo

La aplicación está configurada para desarrollo móvil con Ionic. Para construir para producción:

```bash
npm run build
```

## Licencia

MIT

