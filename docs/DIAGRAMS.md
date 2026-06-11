# Диаграммы по проекту `beltelecom-shop`

Ниже приведены 3 диаграммы, построенные по текущей структуре кода и схемы БД проекта.

---

## 1) Диаграмма классов (архитектура и связи ключевых элементов)

Примечание: backend реализован в процедурном стиле PHP (функции), поэтому UML ниже отражает **логические модули** (контроллеры/сервисы/библиотеки) как «классы-компоненты» для наглядности архитектуры.

```mermaid
classDiagram
direction LR

class ApiEntryPoint {
  +index.php
}

class RouterDispatcher {
  +dispatch_api_request(method, path)
}

class HttpRequest {
  +route_path()
  +read_json_body()
}

class Response {
  +json_response(payload, status=200)
  +json_error(message, status, details?)
}

class Db {
  +db(): PDO
}

class Validation {
  +validate_user_email(email): ?string
  +validate_user_phone_optional(phone): {error, phone}
  +validate_user_address_format(address): ?string
  +validate_user_address_optional(address): {error, address}
  +normalize_user_email(email): string
  +normalize_user_address(address): string
}

class AuthService {
  +current_user_id(): ?int
  +require_auth_user_id(): int
  +get_auth_user_by_id(id): ?array
  +require_admin()
  +require_catalog_manager()
}

class CatalogService {
  +get_categories_list(): array
  +get_products_by_category_slug(slug): array
  +get_product_by_id(id): ?array
  +get_recent_products(limit): array
  +search_products(q, limit): array
  +search_products_starts_with(q, limit): array
}

class OrderService {
  +place_order(body, authUserId, authUser): array
  +get_orders_for_user(userId): array
  +get_orders_for_staff(limit): array
  +update_order_status_for_staff(orderId, status): array
}

class ContactRequestService {
  +create_callback_request(body): array
  +create_stock_request(body): array
  +list_contact_requests(type, status, search): array
  +update_contact_request_status(id, status): array
}

class AdminProductService {
  +admin_format_product(row): array
  +admin_fetch_product_row(id): ?array
  +admin_read_specs_from_body(body): ?array
}

class AdminUserService {
  +admin_format_user(row): array
  +admin_fetch_user_row(id): ?array
  +admin_list_users(search, status, role): array
}

class AuthController {
  +handle_auth_request(method, path): bool
}

class CatalogController {
  +handle_catalog_request(method, path): bool
  +handle_category_slug_request(method, path): bool
}

class OrdersController {
  +handle_orders_request(method, path): bool
}

class AdminProductsController {
  +handle_admin_products_request(method, path): bool
}

class AdminUsersController {
  +handle_admin_users_request(method, path): bool
}

class ContactRequestsController {
  +handle_contact_requests_request(method, path): bool
}

ApiEntryPoint --> RouterDispatcher : calls
ApiEntryPoint --> HttpRequest : uses
ApiEntryPoint --> Response : uses
ApiEntryPoint --> Db : bootstrap DB

RouterDispatcher --> AuthController
RouterDispatcher --> CatalogController
RouterDispatcher --> OrdersController
RouterDispatcher --> AdminProductsController
RouterDispatcher --> AdminUsersController
RouterDispatcher --> ContactRequestsController

AuthController --> Validation
AuthController --> Db
AuthController --> AuthService

CatalogController --> CatalogService

OrdersController --> OrderService
OrdersController --> AuthService

AdminProductsController --> AuthService
AdminProductsController --> AdminProductService
AdminProductsController --> Db

AdminUsersController --> AuthService
AdminUsersController --> Validation
AdminUsersController --> AdminUserService
AdminUsersController --> Db

ContactRequestsController --> ContactRequestService
ContactRequestsController --> AuthService
ContactRequestsController --> Db

CatalogService --> Db
OrderService --> Db
OrderService --> Validation
ContactRequestService --> Db
AdminProductService --> Db
AdminUserService --> Db
```

---

## 2) Диаграмма вариантов использования (Use Case)

```mermaid
flowchart LR

subgraph Actors[Акторы]
  Guest[Гость]
  User[Пользователь]
  Moderator[Модератор]
  Admin[Администратор]
end

subgraph System[Система: beltelecom-shop]
  UC1((Просмотр каталога))
  UC2((Поиск товаров))
  UC3((Просмотр товара))
  UC4((Регистрация))
  UC5((Вход))
  UC6((Просмотр профиля))
  UC7((Редактирование профиля))
  UC8((Оформление заказа))
  UC9((Просмотр своих заказов))

  UC10((Просмотр заказов\nв админ-панели))
  UC11((Смена статуса заказа))
  UC12((Управление товарами\nCRUD))
  UC13((Загрузка изображения товара))

  UC14((Просмотр/обработка заявок\n«Обратный звонок/Наличие»))
  UC15((Смена статуса заявки))

  UC16((Управление пользователями\nCRUD/Роли/Блокировка))
end

Guest --> UC1
Guest --> UC2
Guest --> UC3
Guest --> UC4
Guest --> UC5

User --> UC6
User --> UC7
User --> UC8
User --> UC9

Moderator --> UC10
Moderator --> UC11
Moderator --> UC12
Moderator --> UC13
Moderator --> UC14
Moderator --> UC15

Admin --> UC10
Admin --> UC11
Admin --> UC12
Admin --> UC13
Admin --> UC14
Admin --> UC15
Admin --> UC16

UC8 -. include .-> UC5
UC9 -. include .-> UC5
UC10 -. include .-> UC5
UC11 -. include .-> UC5
UC12 -. include .-> UC5
UC13 -. include .-> UC5
UC14 -. include .-> UC5
UC15 -. include .-> UC5
UC16 -. include .-> UC5
```

Привязка к API (по коду):
- **Авторизация/профиль**: `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`.
- **Каталог**: `/categories`, `/products`, `/products/{id}`, `/search`, `/{categorySlug}`.
- **Заказы**: `/orders`, `/admin/orders`, `/admin/orders/{id}/status`.
- **Админ товары**: `/admin/products`, `/admin/products/{id}`, `/admin/products/upload-image`.
- **Админ пользователи**: `/admin/users`, `/admin/users/{id}`.
- **Заявки**: обрабатываются контроллером `ContactRequestsController` и сервисом `ContactRequestService`.

---

## 3) ER-диаграмма (Сущность–Связь) по `database/schema.sql`

```mermaid
erDiagram
  CATEGORIES {
    BIGINT id PK
    VARCHAR slug UK
    VARCHAR title
    VARCHAR description
    INT sort_order
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  BRANDS {
    BIGINT id PK
    VARCHAR slug UK
    VARCHAR title UK
    TINYINT is_active
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  BRAND_CATEGORIES {
    BIGINT brand_id PK, FK
    BIGINT category_id PK, FK
    TIMESTAMP created_at
  }

  PRODUCTS {
    BIGINT id PK
    BIGINT category_id FK
    VARCHAR slug UK
    VARCHAR sku UK
    VARCHAR name
    TEXT description
    MEDIUMTEXT full_description
    DECIMAL price
    DECIMAL original_price
    INT discount
    VARCHAR image
    VARCHAR color
    VARCHAR brand
    JSON specs_json
    INT stock_quantity
    TINYINT is_active
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  PRODUCT_IMAGES {
    BIGINT id PK
    BIGINT product_id FK
    VARCHAR url
    INT sort_order
    TINYINT is_primary
    TIMESTAMP created_at
  }

  USERS {
    BIGINT id PK
    VARCHAR name
    VARCHAR email UK
    VARCHAR password_hash
    VARCHAR phone
    VARCHAR address
    TINYINT is_admin
    TINYINT is_moderator
    TINYINT is_active
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  ORDERS {
    BIGINT id PK
    BIGINT user_id FK
    VARCHAR order_number UK
    VARCHAR customer_name
    VARCHAR phone
    VARCHAR email
    VARCHAR address
    TEXT comment
    DECIMAL total
    CHAR currency
    VARCHAR status
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  ORDER_ITEMS {
    BIGINT id PK
    BIGINT order_id FK
    BIGINT product_id FK
    VARCHAR slug_snapshot
    VARCHAR image_snapshot
    VARCHAR name_snapshot
    DECIMAL price_snapshot
    INT qty
  }

  ORDER_STATUS_LOG {
    BIGINT id PK
    BIGINT order_id FK
    VARCHAR old_status
    VARCHAR new_status
    VARCHAR note
    TIMESTAMP created_at
  }

  APP_META {
    VARCHAR meta_key PK
    VARCHAR meta_value
  }

  CONTACT_REQUESTS {
    BIGINT id PK
    VARCHAR type
    BIGINT user_id FK
    VARCHAR name
    VARCHAR phone
    VARCHAR email
    VARCHAR topic
    VARCHAR category_slug
    VARCHAR query_text
    VARCHAR status
    TIMESTAMP created_at
  }

  CATEGORIES ||--o{ PRODUCTS : "1:N"
  PRODUCTS  ||--o{ PRODUCT_IMAGES : "1:N"

  BRANDS ||--o{ BRAND_CATEGORIES : "1:N"
  CATEGORIES ||--o{ BRAND_CATEGORIES : "1:N"

  USERS ||--o{ ORDERS : "1:N"
  ORDERS ||--o{ ORDER_ITEMS : "1:N"
  PRODUCTS ||--o{ ORDER_ITEMS : "1:N (nullable product_id)"

  ORDERS ||--o{ ORDER_STATUS_LOG : "1:N"

  USERS ||--o{ CONTACT_REQUESTS : "1:N"
```

