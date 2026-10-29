package com.springerp.numbering;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "document_sequences")
public class DocumentSequence {

    @Id
    @Column(length = 40)
    private String sequenceKey;

    @Column(nullable = false)
    private long nextValue;
}
