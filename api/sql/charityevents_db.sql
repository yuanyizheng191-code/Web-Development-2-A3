-- Charity Events Database (extends the Assessment 2 schema)
--
--
-- This single file recreates the COMPLETE database required for A3:
--   Part 1  categories, organisations, events   (carried over from A2)
--   Part 1  registrations                       (NEW in A3)
--
-- How to import (local MySQL / MySQL Workbench / cPanel phpMyAdmin):
--   mysql -u <user> -p < charityevents_db.sql
-- or, in phpMyAdmin:  Import -> Choose File -> charityevents_db.sql -> Go

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

CREATE DATABASE IF NOT EXISTS `charityevents_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `charityevents_db`;

-- Table: categories            (unchanged from Assessment 2)
DROP TABLE IF EXISTS `registrations`;
DROP TABLE IF EXISTS `events`;
DROP TABLE IF EXISTS `organisations`;
DROP TABLE IF EXISTS `categories`;

CREATE TABLE `categories` (
  `category_id`   int          NOT NULL AUTO_INCREMENT,
  `category_name` varchar(50)  NOT NULL,
  `description`   varchar(255) DEFAULT NULL,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: organisations         (unchanged from Assessment 2)
CREATE TABLE `organisations` (
  `org_id`        int          NOT NULL AUTO_INCREMENT,
  `org_name`      varchar(100) NOT NULL,
  `description`   text,
  `contact_email` varchar(100) DEFAULT NULL,
  `contact_phone` varchar(20)  DEFAULT NULL,
  `website`       varchar(200) DEFAULT NULL,
  PRIMARY KEY (`org_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: events                (A2 columns + latitude/longitude added in A3)
--
-- The two new columns store the geographic coordinates of the event venue so
-- that the Open-Meteo forecast API can be called for that location.
CREATE TABLE `events` (
  `event_id`         int            NOT NULL AUTO_INCREMENT,
  `event_name`       varchar(150)   NOT NULL,
  `description`      text,
  `full_description` text,
  `event_date`       datetime       NOT NULL,
  `location`         varchar(200)   NOT NULL,
  `purpose`          varchar(255)   DEFAULT NULL,
  `ticket_price`     decimal(10,2)  DEFAULT '0.00',
  `goal_amount`      decimal(12,2)  DEFAULT NULL,
  `current_amount`   decimal(12,2)  DEFAULT '0.00',
  `image_url`        varchar(300)   DEFAULT NULL,
  `status`           enum('active','suspended','past','upcoming') DEFAULT 'upcoming',
  `org_id`           int            DEFAULT NULL,
  `category_id`      int            DEFAULT NULL,
  `latitude`         decimal(9,6)   DEFAULT NULL,
  `longitude`        decimal(9,6)   DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `idx_events_status` (`status`),
  KEY `idx_events_date` (`event_date`),
  KEY `org_id` (`org_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`org_id`)      REFERENCES `organisations` (`org_id`),
  CONSTRAINT `events_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: registrations         (NEW in Assessment 3 - Part 1)
--
-- Relationship:  events (1) ---- (N) registrations
--
-- Business rules enforced by this table:
--   * registration_id is the surrogate primary key (unique identifier).
--   * event_id is a FOREIGN KEY to events(event_id); ON DELETE RESTRICT makes
--     the database itself refuse to delete an event that still has
--     registrations.  The API also checks this first so the admin user gets a
--     friendly 409 message instead of a raw SQL error (data integrity rule
--   * UNIQUE KEY uq_event_email = "one user may register for an event once".
--     The same e-mail address may still register for many DIFFERENT events.
--   * tickets_purchased must be at least 1, enforced with a CHECK constraint.
--   * NOTE: as a deliberate simplification ("you are not required to have a USER
--     table"), the attendee details are stored directly on the registration.
CREATE TABLE `registrations` (
  `registration_id`  int          NOT NULL AUTO_INCREMENT,
  `event_id`         int          NOT NULL,
  `attendee_name`    varchar(100) NOT NULL,
  `email`            varchar(120) NOT NULL,
  `phone`            varchar(20)  DEFAULT NULL,
  `organisation`     varchar(120) DEFAULT NULL,
  `tickets_purchased` int         NOT NULL DEFAULT 1,
  `total_amount`     decimal(10,2) DEFAULT '0.00',
  `registration_date` datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes`            varchar(255) DEFAULT NULL,
  PRIMARY KEY (`registration_id`),
  UNIQUE KEY `uq_event_email` (`event_id`, `email`),
  KEY `idx_registrations_date` (`registration_date`),
  KEY `idx_registrations_event` (`event_id`),
  CONSTRAINT `registrations_ibfk_1`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_tickets_positive` CHECK (`tickets_purchased` >= 1)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Initial data

-- ---------------------------- categories -------------------------------------
INSERT INTO `categories` (`category_id`, `category_name`, `description`) VALUES
  (1, 'Fun Run',  'Charity running events'),
  (2, 'Gala',     'Formal charity dinners'),
  (3, 'Auction',  'Silent auction events'),
  (4, 'Concert',  'Charity music concerts');

-- --------------------------- organisations -----------------------------------
INSERT INTO `organisations` (`org_id`, `org_name`, `description`, `contact_email`, `contact_phone`, `website`) VALUES
  (1, 'Hope Foundation', 'Helping children in need',    'info@hope.org',      '02-1111-2222', 'www.hope.org'),
  (2, 'Green Future',    'Environmental charity',      'contact@green.org',  '02-3333-4444', 'www.green.org'),
  (3, 'Health First',    'Medical research charity',   'hello@health.org',   '02-5555-6666', 'www.health.org');

-- ------------------------------- events --------------------------------------
-- latitude / longitude added for every venue so the weather API can be used.
--
-- NOTE ON current_amount
--   In Assessment 2 this column was a manually maintained "raised so far"
--   figure.  In A3 real registrations are recorded, so the API now DERIVES the
--   amount raised from them:  SUM(registrations.tickets_purchased * ticket_price).
--   The seeded values below therefore already equal the sum of the seeded
--   registrations, so the website shows the same figure whether it reads the
--   column or recalculates it after a new booking.  Events with no seeded
--   registrations honestly start at 0.00.
INSERT INTO `events`
  (`event_id`, `event_name`, `description`, `full_description`, `event_date`, `location`, `purpose`,
   `ticket_price`, `goal_amount`, `current_amount`, `image_url`, `status`, `org_id`, `category_id`,
   `latitude`, `longitude`) VALUES
  (1, 'City Fun Run 2026', '5km charity run',
   'Join us for a 5km run to raise funds for children education. Every ticket includes a race bib, a finisher medal and refreshments at the finish line. All proceeds go directly to the Hope Foundation education fund.',
   '2026-11-15 08:00:00', 'Sydney Olympic Park', 'Raise $50,000 for education',
   25.00, 50000.00, 175.00, '/images/funrun.jpg', 'upcoming', 1, 1, -33.847000, 151.063000),

  (2, 'Hope Gala Dinner', 'Formal dinner event',
   'An elegant evening with a three course dinner, live entertainment and a charity auction. Tables of ten are available for corporate sponsors.',
   '2026-11-20 19:00:00', 'Sydney Town Hall', 'Support medical research',
   150.00, 100000.00, 1950.00, '/images/gala.jpg', 'upcoming', 1, 2, -33.873100, 151.206500),

  (3, 'Silent Auction Night', 'Art auction',
   'Bid on donated artworks, sculptures and experiences in a silent auction format. Light refreshments provided and every bid supports environmental projects.',
   '2026-12-05 18:30:00', 'Melbourne Art Gallery', 'Fund environmental projects',
   50.00, 30000.00, 250.00, '/images/auction.jpg', 'upcoming', 2, 3, -37.822600, 144.968900),

  (4, 'Charity Rock Concert', 'Live music night',
   'Enjoy four live bands across one night and support a good cause. Doors open at 7:30pm, headline act at 9:00pm.',
   '2026-12-01 20:00:00', 'Brisbane Entertainment Centre', 'Raise funds for health research',
   80.00, 80000.00, 560.00, '/images/concert.jpg', 'upcoming', 3, 4, -27.470500, 153.046000),

  (5, 'Beach Cleanup Run', 'Run and cleanup',
   'Run along the beach and help clean up the coastline afterwards. Free to enter, donations welcome on the day.',
   '2026-11-25 07:00:00', 'Bondi Beach', 'Environmental awareness',
   0.00, 20000.00, 0.00, '/images/beachrun.jpg', 'active', 2, 1, -33.890800, 151.274300),

  (6, 'Winter Gala 2026', 'Formal winter dinner',
   'A magical winter evening for charity with a formal dinner, jazz trio and a fundraising pledge session.',
   '2026-12-10 18:00:00', 'Perth Convention Centre', 'Support homeless shelters',
   120.00, 60000.00, 240.00, '/images/wintergala.jpg', 'active', 1, 2, -31.952300, 115.860500),

  (7, 'Art for Hope Auction', 'Online art auction',
   'Bid on paintings from local artists in a fully online auction. Registration is required so we can send you the bidding link.',
   '2026-12-18 17:00:00', 'Online', 'Support children arts programs',
   30.00, 25000.00, 30.00, '/images/artauction.jpg', 'active', 1, 3, -33.868800, 151.209300),

  (8, 'Jazz for Health', 'Jazz concert',
   'An evening of jazz music for health research featuring the Adelaide Youth Jazz Ensemble.',
   '2026-09-15 19:30:00', 'Adelaide Jazz Club', 'Fund cancer research',
   60.00, 40000.00, 0.00, '/images/jazz.jpg', 'past', 3, 4, -34.928500, 138.600700);

-- --------------------------- registrations -----------------------------------
-- Note the deliberately different registration dates so the event detail page
-- can prove its "sorted by latest purchase date" behaviour.
INSERT INTO `registrations`
  (`registration_id`, `event_id`, `attendee_name`, `email`, `phone`, `organisation`,
   `tickets_purchased`, `total_amount`, `registration_date`, `notes`) VALUES
  (1,  1, 'Alice Nguyen',    'alice.nguyen@example.com',   '0400 111 222', 'Coffs Harbour High',  2,  50.00, '2026-10-01 09:15:00', 'Running with a friend'),
  (2,  1, 'Ben Carter',      'ben.carter@example.com',     '0400 222 333', NULL,                   1,  25.00, '2026-10-03 14:40:00', NULL),
  (3,  1, 'Chloe Martin',    'chloe.martin@example.com',   '0400 333 444', 'SCU Running Club',    4, 100.00, '2026-10-08 11:05:00', 'Team entry'),
  (4,  2, 'Daniel Okafor',   'daniel.okafor@example.com',  '0400 444 555', 'Okafor Legal',        2, 300.00, '2026-10-02 18:20:00', 'Vegetarian meals x2'),
  (5,  2, 'Ella Fitzgerald', 'ella.fitzgerald@example.com','0400 555 666', NULL,                  1, 150.00, '2026-10-06 20:45:00', NULL),
  (6,  2, 'Farid Hassan',    'farid.hassan@example.com',   '0400 666 777', 'Hassan & Co',        10,1500.00, '2026-10-10 13:30:00', 'Corporate table'),
  (7,  3, 'Grace Lim',       'grace.lim@example.com',      '0400 777 888', NULL,                  3, 150.00, '2026-10-04 10:10:00', NULL),
  (8,  3, 'Henry Patel',     'henry.patel@example.com',    '0400 888 999', 'Art Lovers Club',     2, 100.00, '2026-10-09 16:55:00', NULL),
  (9,  4, 'Isla Robertson',  'isla.robertson@example.com', '0401 111 222', NULL,                  1,  80.00, '2026-10-05 21:00:00', NULL),
  (10, 4, 'Jack Thompson',   'jack.thompson@example.com',  '0401 222 333', 'SCU Student Guild',   6, 480.00, '2026-10-11 12:25:00', 'Student group booking'),
  (11, 6, 'Kiara Singh',     'kiara.singh@example.com',    '0401 333 444', NULL,                  2, 240.00, '2026-10-07 19:35:00', NULL),
  (12, 7, 'Liam O''Brien',   'liam.obrien@example.com',    '0401 444 555', 'Hope Foundation',     1,  30.00, '2026-10-12 08:50:00', 'Online bidding link sent');

-- Events 5 and 8 intentionally have NO registrations, which lets you
-- demonstrate the successful delete path in the admin site, while events 1-4,
-- 6 and 7 demonstrate the blocked delete path (HTTP 409).

SET FOREIGN_KEY_CHECKS = 1;

-- End of file
