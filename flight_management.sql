-- Datenbank erstellen
CREATE DATABASE flight_management;

-- Datenbank auswählen
USE flight_management;

-- Tabelle erstellen
CREATE TABLE flights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    callsign VARCHAR(10) UNIQUE NOT NULL,
    departure VARCHAR(4) NOT NULL,
    arrival VARCHAR(4) NOT NULL,
    aircraft_type VARCHAR(10) NOT NULL,
    squawk VARCHAR(4) NOT NULL,
    status VARCHAR(20) NOT NULL,
    active_runway VARCHAR(10),
    first_waypoint VARCHAR(10),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    distance DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);