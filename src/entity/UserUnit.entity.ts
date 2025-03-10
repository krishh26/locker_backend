// import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
// import { Unit } from './Unit.entity';
// import { User } from './User.entity';
// import { Learner } from './Learner.entity';

// interface PetaUnit {
//     peta_unit_id: string;
//     name: string;
//     status: 'Pending' | 'Inprogress' | 'Complete';
//     comment
// }

// interface SubUnit {
//     sub_unit_id: string;
//     name: string;
//     peta_unit: PetaUnit[];
// }

// @Entity('user_unit')
// export class UserUnit {
//     @PrimaryGeneratedColumn()
//     user_unit_id: number;

//     @ManyToOne(() => Learner)
//     @JoinColumn({ name: 'learner_id', referencedColumnName: 'learner_id' })
//     learner_id: Learner;

//     @ManyToOne(() => Unit)
//     @JoinColumn({ name: 'unit_id', referencedColumnName: 'unit_id' })
//     unit_id: Unit;

//     @Column({ type: 'json', nullable: true })
//     sub_units: SubUnit[];

//     @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//     created_at: Date;

//     @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
//     updated_at: Date;
// }
