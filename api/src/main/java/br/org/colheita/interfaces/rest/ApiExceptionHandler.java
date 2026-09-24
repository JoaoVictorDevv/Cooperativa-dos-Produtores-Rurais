package br.org.colheita.interfaces.rest;

import br.org.colheita.domain.exception.DomainException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(DomainException.class) ProblemDetail domain(DomainException e,HttpServletRequest request){var p=ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(e.status()),e.getMessage());p.setTitle("Regra de negócio");p.setInstance(URI.create(request.getRequestURI()));return p;}
    @ExceptionHandler(MethodArgumentNotValidException.class) ProblemDetail validation(MethodArgumentNotValidException e,HttpServletRequest request){var p=ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,"Existem campos inválidos.");p.setTitle("Falha de validação");p.setInstance(URI.create(request.getRequestURI()));p.setProperty("errors",e.getBindingResult().getFieldErrors().stream().map(f->new FieldError(f.getField(),f.getDefaultMessage())).toList());return p;}
    @ExceptionHandler(DataIntegrityViolationException.class) ProblemDetail integrity(DataIntegrityViolationException e,HttpServletRequest request){var p=ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,"A operação viola uma regra de integridade ou já existe.");p.setTitle("Conflito de dados");p.setInstance(URI.create(request.getRequestURI()));return p;}
    @ExceptionHandler(Exception.class) ProblemDetail unexpected(Exception e,HttpServletRequest request){var p=ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,"Não foi possível concluir a operação.");p.setTitle("Erro interno");p.setInstance(URI.create(request.getRequestURI()));return p;}
    record FieldError(String field,String message){}
}
