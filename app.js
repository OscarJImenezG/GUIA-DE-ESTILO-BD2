// VISUALIZACIÓN Y UTILIDADES
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('section').forEach(s => observer.observe(s));

function copyText(btn) {
    navigator.clipboard.writeText(btn.nextElementSibling.innerText);
    let orig = btn.innerText; btn.innerText = "¡Listo!";
    setTimeout(() => btn.innerText = orig, 1500);
}

//  BASE DE DATOS DE PREGUNTAS (QUIZ)
const quizDB = {
    'del_in': {
        title: "Delimitador",
        q: "¿Por qué cambiamos el DELIMITER a $$?",
        opts: [
            { t: "Para que MySQL no se confunda con los ';' dentro del SP", ok: true },
            { t: "Es un requerimiento estético de SQL", ok: false },
            { t: "Para encriptar el procedimiento", ok: false }
        ]
    },
    'create': {
        title: "Creación",
        q: "Según la convención de nombres, ¿Cuál es correcto?",
        opts: [
            { t: "procedimiento_1()", ok: false },
            { t: "sp_insertar_usuario()", ok: true },
            { t: "hacer_algo()", ok: false }
        ]
    },
    'begin': {
        title: "Inicio",
        q: "¿Qué representa el bloque BEGIN ... END?",
        opts: [
            { t: "El cuerpo lógico del procedimiento", ok: true },
            { t: "La conexión a la base de datos", ok: false },
            { t: "El inicio de la transacción solamente", ok: false }
        ]
    },
    'vars': {
        title: "Variables",
        q: "¿Dónde se deben declarar las variables locales?",
        opts: [
            { t: "En cualquier parte del código", ok: false },
            { t: "Justo después del BEGIN, antes de la lógica", ok: true },
            { t: "Después del COMMIT", ok: false }
        ]
    },
    'handler': {
        title: "Manejo de Errores",
        q: "¿Para qué sirve un HANDLER FOR SQLEXCEPTION?",
        opts: [
            { t: "Para ignorar todos los errores", ok: false },
            { t: "Para capturar errores y evitar que el programa colapse", ok: true },
            { t: "Para hacer el código más rápido", ok: false }
        ]
    },
    'trans': {
        title: "Transacción",
        q: "¿Por qué usamos START TRANSACTION?",
        opts: [
            { t: "Para asegurar que todas las operaciones se hagan o ninguna", ok: true },
            { t: "Para conectarse al servidor", ok: false },
            { t: "Para guardar los datos inmediatamente", ok: false }
        ]
    },
    'logic': {
        title: "Lógica Segura",
        q: "En términos de seguridad, ¿Cómo debes usar los parámetros en la lógica?",
        opts: [
            { t: "Concatenarlos con comillas", ok: false },
            { t: "Usarlos directamente o con PREPARE statement (?)", ok: true },
            { t: "No usar parámetros", ok: false }
        ]
    },
    'commit': {
        title: "Confirmación",
        q: "¿Qué sucede si olvidas el COMMIT en una transacción?",
        opts: [
            { t: "Se guardan los datos automáticamente", ok: false },
            { t: "Los cambios no se hacen permanentes", ok: true },
            { t: "Da error de sintaxis", ok: false }
        ]
    },
    'end': {
        title: "Cierre",
        q: "¿Con qué caracteres debemos cerrar el bloque END?",
        opts: [
            { t: "END;", ok: false },
            { t: "END$$ (o el delimitador que definiste)", ok: true },
            { t: "Solo END", ok: false }
        ]
    },
    'del_out': {
        title: "Restaurar",
        q: "¿Por qué regresamos el DELIMITER a ';'?",
        opts: [
            { t: "Para restaurar el comportamiento normal de la consola", ok: true },
            { t: "No es necesario, se puede quedar en $$", ok: false },
            { t: "Para cerrar la conexión", ok: false }
        ]
    }
};

// LOGICA DEL LABORATORIO
let userBlocks = [];
let masteredBlocks = [];
let pendingBlockId = null;

const editor = document.getElementById('editor');
const liveCode = document.getElementById('liveCode');
const consoleDiv = document.getElementById('console');
const modal = document.getElementById('quizModal');
const qText = document.getElementById('quizQuestion');
const qOpts = document.getElementById('quizOptions');

// Base de datos de bloques
const blocksDB = {
    'del_in': { label: 'DELIMITER $$', sql: 'DELIMITER $$\n', cls: 'blk-struc' },
    'create': { label: 'CREATE PROCEDURE sp_demo()', sql: 'CREATE PROCEDURE sp_demo(IN p_id INT)\n', cls: 'blk-struc' },
    'begin': { label: 'BEGIN', sql: 'BEGIN\n', cls: 'blk-struc' },
    'vars': { label: 'DECLARE variables...', sql: '    DECLARE v_saldo DECIMAL(10,2);\n    DECLARE v_existe INT DEFAULT 0;\n', cls: 'blk-var' },
    'handler': { label: 'HANDLER SQLEXCEPTION', sql: '    DECLARE EXIT HANDLER FOR SQLEXCEPTION\n    BEGIN\n        ROLLBACK;\n        SELECT \'Error\' as msg;\n    END;\n', cls: 'blk-error' },
    'trans': { label: 'START TRANSACTION', sql: '\n    START TRANSACTION;\n', cls: 'blk-logic' },
    'logic': { label: '-- LÓGICA SQL --', sql: '        -- Aquí va tu lógica de negocio\n        UPDATE cuentas SET saldo = saldo + 100 WHERE id = p_id;\n', cls: 'blk-logic' },
    'commit': { label: 'COMMIT', sql: '    COMMIT;\n', cls: 'blk-logic' },
    'end': { label: 'END$$', sql: 'END$$\n', cls: 'blk-struc' },
    'del_out': { label: 'DELIMITER ;', sql: 'DELIMITER ;\n', cls: 'blk-struc' }
};

// Logros
const controlsArea = document.querySelector('.lab-controls');
const statsDiv = document.createElement('div');
statsDiv.id = 'mastered-stats';
statsDiv.style.marginTop = '15px';
statsDiv.style.color = '#ccc';
statsDiv.style.fontSize = '0.9rem';
statsDiv.innerHTML = '<strong>🏆 Conceptos Dominados:</strong> <span id="mastered-list" style="color:var(--accent)">Ninguno aún</span>';
controlsArea.appendChild(statsDiv);


// FUNCIONES DEL QUIZ MODAL
function prepareBlock(id) {
    if (masteredBlocks.includes(id)) {
        addBlockConfirmed(id);
        return;
    }
    pendingBlockId = id;
    const quiz = quizDB[id];
    qText.innerText = quiz.q;
    qOpts.innerHTML = '';
    const shuffledOpts = [...quiz.opts].sort(() => Math.random() - 0.5);
    shuffledOpts.forEach(opt => {
        let btn = document.createElement('button');
        btn.className = 'quiz-btn';
        btn.innerText = opt.t;
        btn.onclick = () => checkAnswer(opt.ok, id);
        qOpts.appendChild(btn);
    });
    modal.style.display = 'flex';
}

function checkAnswer(isCorrect, id) {
    if (isCorrect) {
        modal.style.display = 'none';
        if (!masteredBlocks.includes(id)) {
            masteredBlocks.push(id);
            updateMasteredUI();
        }
        addBlockConfirmed(id);
        msg("✅ ¡Correcto! Arrastra los bloques para reordenarlos.", "c-succ");
    } else {
        alert("❌ Respuesta incorrecta. Inténtalo de nuevo.");
    }
}

function updateMasteredUI() {
    const listSpan = document.getElementById('mastered-list');
    listSpan.innerText = masteredBlocks.length === 0 ? "Ninguno aún" : masteredBlocks.map(id => quizDB[id].title).join(', ');
}

function closeQuiz() {
    modal.style.display = 'none';
    pendingBlockId = null;
    msg("Cancelado.", "console");
}

// --- GESTIÓN DE BLOQUES (AÑADIR Y BORRAR) ---
function addBlockConfirmed(id) {
    const paletteBtn = document.querySelector(`#palette div[onclick="prepareBlock('${id}')"]`);
    if (paletteBtn) paletteBtn.style.display = 'none';
    userBlocks.push(id);
    render();
    updateLiveCode();
}

function removeBlock(idx) {
    const idToRestore = userBlocks[idx];
    const paletteBtn = document.querySelector(`#palette div[onclick="prepareBlock('${idToRestore}')"]`);
    if (paletteBtn) paletteBtn.style.display = '';
    userBlocks.splice(idx, 1);
    render();
    updateLiveCode();
}

function resetLab() {
    const allButtons = document.querySelectorAll('#palette div');
    allButtons.forEach(btn => btn.style.display = '');
    userBlocks = [];
    masteredBlocks = [];
    updateMasteredUI();
    render();
    updateLiveCode();
    msg("> Reiniciado.", "console");
}


//   LÓGICA DE ARRASTRE Y SOLTAR 

// Configuramos el contenedor para recibir elementos
editor.addEventListener('dragover', (e) => {
    e.preventDefault();

    // Obtener el elemento después del cursor del mouse
    const afterElement = getDragAfterElement(editor, e.clientY);
    const draggable = document.querySelector('.dragging');

    // Animación visual: Insertamos el elemento en la posición correcta
    if (afterElement == null) {
        editor.appendChild(draggable);
    } else {
        editor.insertBefore(draggable, afterElement);
    }
});

// 2. Al soltar, actualizamos el arreglo real para que coincida con lo visual
editor.addEventListener('drop', (e) => {
    e.preventDefault();
    syncArrayWithDOM(); //  Sincronizar lógica con visual
    updateLiveCode();
});

// 3. Función matemática para detectar dónde estamos soltando
function getDragAfterElement(container, y) {
    // Tomamos todos los bloques que NO se están arrastrando
    const draggableElements = [...container.querySelectorAll('.assembled-block:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        // Buscamos el elemento cuyo centro esté justo debajo del cursor
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 4. Función para leer y reconstruir el array 
function syncArrayWithDOM() {
    const newOrder = [];
    const children = editor.querySelectorAll('.assembled-block');
    children.forEach(child => {
        // Obtenemos el ID original guardado en el atributo data-id
        newOrder.push(child.getAttribute('data-id'));
    });
    userBlocks = newOrder;
}

//  RENDERIZADO VISUAL
function render() {
    editor.innerHTML = '';
    if (userBlocks.length === 0) {
        editor.innerHTML = '<div class="placeholder">Arrastra aquí...</div>';
        return;
    }

    userBlocks.forEach((id, idx) => {
        let b = blocksDB[id];
        let div = document.createElement('div');

        div.className = `scratch-block ${b.cls} assembled-block`;
        div.setAttribute('data-id', id); // Guardamos el ID para recuperarlo al soltar
        div.setAttribute('draggable', 'true');

        div.innerHTML = `
            <span>${b.label}</span>
            <span style="float:right; color:#ffa5a5; font-weight:bold; cursor:pointer;" onclick="removeBlock(${idx})">×</span>
        `;

        // Arrastre Individual
        div.addEventListener('dragstart', () => {
            div.classList.add('dragging');
            editor.classList.add('drag-active');
        });

        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
            editor.classList.remove('drag-active');
            syncArrayWithDOM();
            updateLiveCode();
        });

        editor.appendChild(div);
    });
}

function updateLiveCode() {
    if (userBlocks.length === 0) {
        liveCode.innerText = "-- El código aparecerá aquí...";
        return;
    }
    let sql = "";
    userBlocks.forEach(id => {
        sql += blocksDB[id].sql;
    });
    liveCode.innerText = sql;
    liveCode.scrollTop = liveCode.scrollHeight;
}

function validateCode() {
    if (userBlocks.length === 0) return msg("⚠️ Agrega bloques primero.", "c-err");

    if (userBlocks[0] !== 'del_in') return msg("⚠️ Error: Falta DELIMITER $$ al inicio.", "c-err");
    if (userBlocks[1] !== 'create') return msg("⚠️ Error: Falta CREATE PROCEDURE.", "c-err");
    if (userBlocks[2] !== 'begin') return msg("⚠️ Error: Falta BEGIN.", "c-err");

    let idxVars = userBlocks.indexOf('vars');
    let idxHandler = userBlocks.indexOf('handler');
    let idxTrans = userBlocks.indexOf('trans');

    if (idxTrans !== -1 && idxVars > idxTrans) return msg("⚠️ Lógica: Variables van ANTES de transacción.", "c-err");
    if (idxTrans !== -1 && idxHandler > idxTrans) return msg("⚠️ Lógica: Handler va ANTES de transacción.", "c-err");
    if (idxVars !== -1 && idxHandler !== -1 && idxHandler < idxVars) return msg("⚠️ Sintaxis: Variables primero, luego Handlers.", "c-err");

    if (userBlocks[userBlocks.length - 2] !== 'end') return msg("⚠️ Error: Falta END$$ al final.", "c-err");
    if (userBlocks[userBlocks.length - 1] !== 'del_out') return msg("⚠️ Error: Falta restaurar DELIMITER ;", "c-err");

    return msg("✅ ¡Perfecto! Estructura válida y segura.", "c-succ");
}

function msg(txt, cls) {
    consoleDiv.innerText = txt;
    consoleDiv.className = "console " + cls;
}

function downloadSQL() {
    const sqlContent = `
    -- BASE DE DATOS MAESTRA


-- Este archivo prepara todas las tablas necesarias para ejecutar
-- CUALQUIER ejemplo de la guía (Seguridad, Errores, Triggers, SPs).



DROP DATABASE IF EXISTS guia_estilo;
CREATE DATABASE IF NOT EXISTS guia_estilo;
USE guia_estilo;



-- 1. PARA LA SECCIÓN: ESTRUCTURA Y ESTILO



CREATE TABLE IF NOT EXISTS cuentas_bancarias (
    cliente_id VARCHAR(100) PRIMARY KEY,
    saldo DECIMAL(10,2)
);
-- Insertamos un dato de prueba
INSERT INTO cuentas_bancarias VALUES 
('Peter', 1000.00),
('Jonatan', 200.00),
('Liz', 3500.00);

DELIMITER $$
CREATE PROCEDURE sp_actualizar_saldo_usuario (
    IN p_saldo DECIMAL(10,2), 
    IN p_usuario VARCHAR(100)
)
BEGIN
    -- Encabezado de Documentación
    -- Autor: GOYO | Fecha: 2025-10-23 | Propósito: Inserta y actualiza saldo

    -- Declaración de Variables
    DECLARE v_filas_afectadas INT DEFAULT 0;
    DECLARE v_error_msg VARCHAR(255);

    -- Control de Errores
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;      
        SET v_error_msg = 'Error crítico: No se pudo procesar la transacción.';
        SELECT v_error_msg AS mensaje_error;
    END;

    -- Inicio de Transacción
    START TRANSACTION; 
    -- Lógica del Procedimiento
    UPDATE cuentas_bancarias
    SET saldo = saldo + p_saldo
    WHERE cliente_id = p_usuario;

    -- Valida que realmente se actualizo una cuenta
    SET v_filas_afectadas = ROW_COUNT();

    IF v_filas_afectadas = 0 THEN
        ROLLBACK;
        SET v_error_msg = 'Error: Usuario no encontrado.';
        SELECT v_error_msg AS mensaje_error;
    ELSE
        -- Confirmar Cambios
        COMMIT;
        SET v_error_msg = 'Éxito: Saldo actualizado correctamente.';
        SELECT v_error_msg AS mensaje_exito;
    END IF;

END$$

DELIMITER ;

-- Ver saldo INICIAL de Jonatan:
-- SELECT * FROM cuentas_bancarias WHERE cliente_id = 'Jonatan';

-- Actualizar el saldo de Jonatan:
-- CALL sp_actualizar_saldo_usuario (200.00, 'Jonatan');

-- Ver saldo ACTUALIZADO de Jonatan
-- SELECT * FROM cuentas_bancarias WHERE cliente_id = 'Jonatan';


-- Muestra de manejo de un error (NO SE ENCUENTRA EL USUARIO JUAN)
-- CALL sp_actualizar_saldo_usuario (200.00, 'Juan');





-- 2. PARA LA SECCIÓN: SEGURIDAD (Inyección SQL)



-- La Tabla con datos sensibles
DROP TABLE IF EXISTS usuarios_secretos;
CREATE TABLE usuarios_secretos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50),
    password VARCHAR(50),
    rol VARCHAR(20)
);

-- Insertamos al ADMIN (El objetivo del ataque) y un usuario normal
INSERT INTO usuarios_secretos (usuario, password, rol) VALUES 
('admin', 'X8s7#dL!', 'SUPER_ADMIN'),
('pepe', '123456', 'USER');

DELIMITER $$

-- EL CÓDIGO VULNERABLE (Concatenación) 
-- Es el hueco de seguridad.
DROP PROCEDURE IF EXISTS sp_login_vulnerable$$
CREATE PROCEDURE sp_login_vulnerable(IN p_usuario VARCHAR(100))
BEGIN
    -- Peligro: Concatenamos lo que el usuario escriba directamente en la orden
    SET @sql = CONCAT('SELECT * FROM usuarios_secretos WHERE usuario = "', p_usuario, '"');
    
    SELECT @sql AS 'DEBUG: Consulta Generada';
    
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END$$

-- SEGURIDAD COMPROMETIDA:
-- CALL sp_login_vulnerable('admin" OR "1"="1');

-- EL CÓDIGO SEGURO (Parametrizado)
-- Este SP usa marcadores (?) para separar datos de instrucciones.
DROP PROCEDURE IF EXISTS sp_login_seguro$$
CREATE PROCEDURE sp_login_seguro(IN p_usuario VARCHAR(100))
BEGIN
    -- Seguridad: Usamos ? como marcador de posición
    SET @sql = 'SELECT * FROM usuarios_secretos WHERE usuario = ?';
    
    PREPARE stmt FROM @sql;
    -- El motor de la BD trata p_usuario estrictamente como texto, no como código
    EXECUTE stmt USING p_usuario;
    DEALLOCATE PREPARE stmt;
END$$

DELIMITER ;

-- MAYOR SEGURIDAD:
-- CALL sp_login_seguro('admin" OR "1"="1');




-- 3. PARA LA SECCIÓN: GESTIÓN DE ERRORES 



-- Reiniciamos el entorno
DROP TABLE IF EXISTS log_transacciones;
DROP TABLE IF EXISTS error_logs;
DROP TABLE IF EXISTS cuentas;

-- Tabla de Cuentas
CREATE TABLE cuentas (
    id INT PRIMARY KEY,
    titular VARCHAR(100),
    saldo DECIMAL(10,2)
);

-- Datos de prueba: Juan tiene 1000, María tiene 0
INSERT INTO cuentas VALUES 
(1, 'Juan Emisor', 1000.00),
(2, 'Maria Receptor', 0.00);

-- Tabla de Logs de Errores
CREATE TABLE error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    error_code CHAR(5),
    error_msg TEXT,
    user_evt VARCHAR(100),
    created_at DATETIME
);

-- Tabla de Transacciones 
-- Guardamos quién envió y quién recibió
CREATE TABLE log_transacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emisor_id INT,
    receptor_id INT,
    monto DECIMAL(10,2),
    status VARCHAR(20),
    fecha DATETIME
);

DELIMITER $$
                        
CREATE PROCEDURE sp_transferencia_segura(
    IN p_emisor INT, 
    IN p_receptor INT,
    IN p_monto DECIMAL(10,2)
)
BEGIN
    -- Declarar variables
    DECLARE code CHAR(5) DEFAULT '00000';
    DECLARE msg TEXT;
    DECLARE saldo_actual DECIMAL(10,2);

    -- Si ocurre CUALQUIER error SQL
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        -- a) Revertir cambios pendientes
        ROLLBACK;
        
        -- b) Obtener detalles del error
        GET DIAGNOSTICS CONDITION 1
            code = RETURNED_SQLSTATE, msg = MESSAGE_TEXT;
            
        -- c) Guardar en Bitácora de Errores
        INSERT INTO error_logs (error_code, error_msg, user_evt, created_at)
        VALUES (code, msg, USER(), NOW());
        
        SELECT 'Error procesado: Transacción revertida.' AS Status;
    END;

    -- Inicio de la Transacción
    START TRANSACTION;

    -- Validar y BLOQUEAR saldo
    SELECT saldo INTO saldo_actual FROM cuentas 
    WHERE id = p_emisor FOR UPDATE;
    
    IF saldo_actual < p_monto OR saldo_actual IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Saldo Insuficiente o cuenta inválida';
    END IF;

    -- Restar al Emisor
    UPDATE cuentas SET saldo = saldo - p_monto WHERE id = p_emisor;

    -- Sumar al Receptor
    UPDATE cuentas SET saldo = saldo + p_monto WHERE id = p_receptor;

    -- Registrar la transacción (INSERT histórico, no UPDATE masivo)
    INSERT INTO log_transacciones (emisor_id, receptor_id, monto, status, fecha)
    VALUES (p_emisor, p_receptor, p_monto, 'OK', NOW());

    -- Confirmar cambios
    COMMIT;
    
END$$

DELIMITER ;

-- EJEMPLO DE FUNCIONAMIENTO NORMAL:

-- Primero verifica los saldos:
-- SELECT * FROM cuentas; 

-- Ahora ejecuta la transacción:
-- CALL sp_transferencia_segura(1, 2, 200.00);

-- VERIFICACIÓN:
-- 	Juan debe tener 800, María 200
-- 		SELECT * FROM cuentas; 
-- 	Debe aparecer el registro en el histórico
-- 		SELECT * FROM log_transacciones;



-- FALLO POR FONDOS INSUFICIENTES: 
-- CALL sp_transferencia_segura(1, 2, 5000.00);

-- VERIFICACIÓN:
-- 	La consola debe decir "Error procesado..."
-- 	Los saldos NO deben haber cambiado (Juan sigue con 800)
-- 		SELECT * FROM cuentas;
-- 	El error debe estar en el log
-- 		SELECT * FROM error_logs;




-- 4. PARA LA SECCIÓN: TRIGGERS (Auditoría)



DROP TABLE IF EXISTS productos;
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    precio DECIMAL(10,2)
);

INSERT INTO productos (nombre, precio) VALUES 
('Laptop Developer', 25000.00), 
('Monitor 4K', 8000.00),
('Teclado Mecánico', 1500.00);

DROP TABLE IF EXISTS historial_precios;
CREATE TABLE historial_precios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_id INT,
    precio_ant DECIMAL(10,2),
    fecha DATETIME
);


DELIMITER //
                    
CREATE TRIGGER tr_productos_before_update
BEFORE UPDATE ON productos
FOR EACH ROW
BEGIN
    -- Si el precio cambia, guardamos el historial
    IF OLD.precio <> NEW.precio THEN
        INSERT INTO historial_precios (prod_id, precio_ant, fecha)
        VALUES (OLD.id, OLD.precio, NOW());
    END IF;

    END //

DELIMITER ;
                
-- Verifica los precios actuales:
-- SELECT * FROM productos;


-- Actualizamos  el precio de la laptop:
/*
UPDATE productos 
SET precio = 28000.00 
WHERE id = 1; 
*/


-- REVISAMOS QUE EL CAMBIO SE EFECTUO EN EL HISTORICO:
-- SELECT * FROM historial_precios;
                



-- 5. PARA LA SECCIÓN: EJEMPLOS COMENTADOS 



DROP TABLE IF EXISTS alumnos;
CREATE TABLE alumnos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    saldo DECIMAL(10,2) -- Deuda pendiente
);

INSERT INTO alumnos (nombre, saldo) VALUES 
('Roberto Calidad', 5000.00), 
('Lucía Diseño', 1200.00),
('Juan SinDeuda', 0.00);

DROP TABLE IF EXISTS pagos;
CREATE TABLE pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_alumno INT,
    monto DECIMAL(10,2),
    fecha DATETIME,
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id)
);

DROP TABLE IF EXISTS bitacora_log;
CREATE TABLE bitacora_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tabla VARCHAR(50),
    accion VARCHAR(20),
    id_registro INT,
    valor_anterior VARCHAR(255),
    valor_nuevo VARCHAR(255),
    usuario VARCHAR(100),
    fecha DATETIME
);

DELIMITER //

CREATE PROCEDURE sp_insertar_pago (
    IN p_id_alumno INT,
    IN p_monto DECIMAL(10,2)
)
BEGIN
    -- Declaración de variables
    DECLARE v_saldo_pendiente DECIMAL(10,2);
    
    -- Manejo de errores: Si algo falla, revertimos todo
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Transacción fallida' AS mensaje;
    END;

    START TRANSACTION;

    -- 1. Validación de negocio
    SELECT saldo INTO v_saldo_pendiente FROM alumnos WHERE id = p_id_alumno;
    
    IF v_saldo_pendiente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El alumno no existe';
    ELSEIF p_monto <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser positivo';
    END IF;

    -- 2. Inserción
    INSERT INTO pagos (id_alumno, monto, fecha) VALUES (p_id_alumno, p_monto, NOW());

    -- 3. Lógica derivada (Actualizar saldo)
    UPDATE alumnos SET saldo = saldo - p_monto WHERE id = p_id_alumno;

    COMMIT;

END //

DELIMITER ;


DELIMITER //

CREATE TRIGGER tr_update_pagos_after
AFTER UPDATE ON pagos
FOR EACH ROW
BEGIN
    -- Solo registramos si hubo un cambio real en el monto
    IF OLD.monto <> NEW.monto THEN
        INSERT INTO bitacora_log 
            (tabla, accion, id_registro, valor_anterior, valor_nuevo, usuario, fecha)
        VALUES 
            ('pagos', 'UPDATE', OLD.id, OLD.monto, NEW.monto, CURRENT_USER(), NOW());
    END IF;

END //

DELIMITER ;


-- VERIFICAMOS CUANTO DEBEN LOS ALUMNOS:
-- SELECT * FROM ALUMNOS;

-- Podemos generamos el pago de un alumno con deuda:
-- CALL sp_insertar_pago (2, 600.00);


-- VERIFICAMOS EL PAGO:
-- SELECT * FROM pagos;
-- El ID de pago es el 1 y el monto fue 600.00

-- RECTIFICAMOS QUE SE EFECTUO LA DIFERENCIA EN LA DEUDA DEL ALUMNO
-- SELECT * FROM ALUMNOS WHERE id = 2;


-- Hacemos un UPDATE manual para despertar al trigger:
/*
UPDATE pagos 
SET monto = 200.00 
WHERE id = 1;
*/
-- REVISAMOS LA BITÁCORA (SE REGISTRARÁ SOLO MODIFICACIONES DENTRO DEL SISTEMA)
-- SELECT * FROM bitacora_log;

`;

    // Crear el archivo blob y descargarlo
    const blob = new Blob([sqlContent], { type: 'application/sql' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'guia_estilo.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}