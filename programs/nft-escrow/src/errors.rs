use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCodes {

    #[msg("Not enough lamport")]
    NotEnoughLamport,

    #[msg("Invalid mint nft")]
    InvalidMintNft,

    #[msg("Invalid escrow")]
    InvalidEscrow,

    #[msg("Invalid bob or alice")]
    InvalidBobOrAlice

}
