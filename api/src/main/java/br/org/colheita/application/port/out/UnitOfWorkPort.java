package br.org.colheita.application.port.out;

import java.util.function.Supplier;

public interface UnitOfWorkPort {
    <T> T execute(Supplier<T> work);
    void execute(Runnable work);
}

