#!/usr/bin/env bash
# usage: gen-svc.sh <dir> <pkg> <ClassPrefix> <app-name> <port> <DBName> [extra-annotations] [extra-imports]
set -e
d=$1; pkg=$2; cls=$3; app=$4; port=$5; db=$6; extra=${7:-}; imports=${8:-}
base=~/Documents/PROJECTS_TECKSTACK/Java_Projects/HospitalManagement/services/$d
mkdir -p $base/src/main/java/com/hospital/$pkg $base/src/main/resources
cat > $base/src/main/java/com/hospital/$pkg/${cls}Application.java <<JAVA
package com.hospital.$pkg;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
$imports

@SpringBootApplication(scanBasePackages = {"com.hospital.$pkg", "com.hospital.common"})
@EntityScan({"com.hospital.$pkg", "com.hospital.common.kafka"})
@EnableJpaRepositories({"com.hospital.$pkg", "com.hospital.common.kafka"})
$extra
public class ${cls}Application {
    public static void main(String[] args) {
        SpringApplication.run(${cls}Application.class, args);
    }
}
JAVA
