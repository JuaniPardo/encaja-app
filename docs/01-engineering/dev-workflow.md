

# Development Workflow — Encaja App

## Objetivo

Definir un flujo de trabajo claro, consistente y escalable para desarrollo, versionado y releases.

---

## 1. Branching strategy

- `main` → producción (código estable)
- `develop` → integración (testing previo a release)
- `feature/*` → desarrollo de nuevas funcionalidades

Ejemplo:

```
feature/transfer-between-accounts
```

---

## 2. Flujo de trabajo

```
feature → develop → main
```

### Paso a paso

1. Crear feature branch desde `develop`
2. Desarrollar funcionalidad
3. Commits incrementales
4. Testeo local
5. Merge a `develop`
6. Testeo más amplio (QA manual / preview)
7. Ajustes si es necesario
8. Preparación de release

---

## 3. Versionado (SemVer)

Se utiliza Semantic Versioning:

- `MAJOR` → cambios incompatibles
- `MINOR` → nuevas funcionalidades compatibles
- `PATCH` → fixes

### Reglas

- ❌ No versionar en branches `feature/*`
- ❌ No versionar en `develop`
- ✅ Versionar únicamente al hacer release
- ✅ La versión siempre refleja el estado de `main`

---

## 4. Releases

### Flujo de release

1. Código estable en `develop`
2. Validación completa
3. Actualizar `CHANGELOG.md`
4. Bump de versión en `package.json`
5. Merge `develop` → `main`
6. Crear tag:

```
vX.Y.Z
```

7. Publicar release

---

## 5. Changelog

- Mantener actualizado durante el desarrollo
- Se vuelve oficial al hacer release
- Formato recomendado:

```
## [1.1.0] - 2026-04-XX

### Added
- Transfer between accounts

### Fixed
- Balance calculation bug
```

---

## 6. Convención de commits

Formato recomendado:

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `chore:` tareas internas
- `refactor:` mejoras sin cambio funcional

Ejemplo:

```
feat(transfers): add transfer between accounts
```

---

## 7. Checklist de release

Antes de publicar:

- [ ] Funcionalidad testeada
- [ ] No hay errores críticos
- [ ] Changelog actualizado
- [ ] Versión actualizada
- [ ] Merge correcto a main
- [ ] Tag creado

---

## 8. Tipos de release

### Feature release

- Proviene de `develop`
- Incluye nuevas funcionalidades

### Hotfix (futuro)

- Parte desde `main`
- Corrige bugs críticos en producción

---

## 9. Principios

- No modificar releases anteriores
- Mantener trazabilidad
- Priorizar estabilidad sobre velocidad
- Cada release debe ser confiable

---